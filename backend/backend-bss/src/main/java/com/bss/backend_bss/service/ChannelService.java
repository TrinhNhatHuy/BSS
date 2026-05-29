package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.channel.*;
import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.ChannelExportId;
import com.bss.backend_bss.entity.ChannelGroup;
import com.bss.backend_bss.entity.Source;
import com.bss.backend_bss.exception.DuplicateResourceException;
import com.bss.backend_bss.exception.InvalidReferenceException;
import com.bss.backend_bss.exception.ResourceNotFoundException;
import com.bss.backend_bss.repository.ChannelGroupRepository;
import com.bss.backend_bss.repository.ChannelRepository;
import com.bss.backend_bss.repository.SourceRepository;
import com.bss.backend_bss.repository.UserRepository;
import com.bss.backend_bss.specification.ChannelSpecifications;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Channel CRUD + search.
 *
 * Design notes:
 *  • Bulk-resolve channelGroupName / lastAiUpdateByUsername to avoid N+1 queries
 *    on the list endpoint. Polling will hammer this; per-row lookups would
 *    crush the DB.
 *  • Replacement semantics on update: provided sources/exportIds fully replace
 *    the existing ones. Frontend always sends the complete set.
 *  • Source name list and channel group ID are validated against the DB before
 *    save — InvalidReferenceException (422) on bad FKs.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChannelService {

    private final ChannelRepository channelRepository;
    private final ChannelGroupRepository channelGroupRepository;
    private final SourceRepository sourceRepository;
    private final UserRepository userRepository;
    private final ChannelMapper channelMapper;

    // ============================================================
    // LIST + SEARCH
    // ============================================================

    @Transactional(readOnly = true)
    public Page<ChannelResponse> list(ChannelFilter filter, Pageable pageable) {
        Page<Channel> page = channelRepository.findAll(
                ChannelSpecifications.build(filter),
                pageable
        );

        // Bulk-fetch supporting data for all channels on this page in 2 queries
        // (instead of 2 × page-size queries inside the mapper).
        Map<Long, String> groupNames = lookupGroupNames(page.getContent());
        Map<Long, String> usernames = lookupUsernames(page.getContent());

        return page.map(c -> channelMapper.toResponse(c, groupNames, usernames));
    }

    // ============================================================
    // DETAIL
    // ============================================================

    @Transactional(readOnly = true)
    public ChannelResponse getById(String id) {
        Channel channel = channelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Channel not found: " + id));

        Map<Long, String> groupNames = lookupGroupNames(List.of(channel));
        Map<Long, String> usernames = lookupUsernames(List.of(channel));

        return channelMapper.toResponse(channel, groupNames, usernames);
    }

    // ============================================================
    // CREATE
    // ============================================================

    @Transactional
    public ChannelResponse create(CreateChannelRequest req) {
        if (channelRepository.existsById(req.getId())) {
            throw new DuplicateResourceException(
                    "Channel ID '" + req.getId() + "' already exists");
        }

        // Validate channel group exists if provided
        if (req.getChannelGroupId() != null
                && !channelGroupRepository.existsById(req.getChannelGroupId())) {
            throw new InvalidReferenceException(
                    "Channel group not found: " + req.getChannelGroupId());
        }

        // Validate sources exist if provided
        Set<Source> resolvedSources = resolveSources(req.getSources());

        Channel channel = Channel.builder()
                .id(req.getId())
                .name(req.getName())
                .channelGroupId(req.getChannelGroupId())
                .numberOfReschedules(0)
                .aiUpdateStatus(Channel.AiUpdateStatus.NOT_UPDATED)
                .sources(resolvedSources)
                .build();

        // Attach export IDs (must be done after channel exists since they FK to it)
        attachExportIds(channel, req.getExportIds());

        Channel saved = channelRepository.save(channel);
        log.info("Created channel '{}'", saved.getId());

        return channelMapper.toResponse(
                saved,
                lookupGroupNames(List.of(saved)),
                lookupUsernames(List.of(saved))
        );
    }

    // ============================================================
    // UPDATE
    // ============================================================

    @Transactional
    public ChannelResponse update(String id, UpdateChannelRequest req) {
        Channel channel = channelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Channel not found: " + id));

        if (req.getChannelGroupId() != null
                && !channelGroupRepository.existsById(req.getChannelGroupId())) {
            throw new InvalidReferenceException(
                    "Channel group not found: " + req.getChannelGroupId());
        }

        channel.setName(req.getName());
        channel.setChannelGroupId(req.getChannelGroupId());

        // Replacement semantics: clear old sources, set new ones
        channel.getSources().clear();
        channel.getSources().addAll(resolveSources(req.getSources()));

        // Replacement semantics for export IDs.
        // orphanRemoval=true on the @OneToMany deletes the cleared rows.
        channel.getExportIds().clear();
        attachExportIds(channel, req.getExportIds());

        Channel saved = channelRepository.save(channel);
        log.info("Updated channel '{}'", saved.getId());

        return channelMapper.toResponse(
                saved,
                lookupGroupNames(List.of(saved)),
                lookupUsernames(List.of(saved))
        );
    }

    // ============================================================
    // DELETE
    // ============================================================

    @Transactional
    public void delete(String id) {
        if (!channelRepository.existsById(id)) {
            throw new ResourceNotFoundException("Channel not found: " + id);
        }
        channelRepository.deleteById(id);
        log.info("Deleted channel '{}'", id);
    }

    // ============================================================
    // PRIVATE HELPERS
    // ============================================================

    /**
     * Bulk fetch group names for the channels on this page.
     * One query instead of N.
     */
    private Map<Long, String> lookupGroupNames(List<Channel> channels) {
        Set<Long> ids = channels.stream()
                .map(Channel::getChannelGroupId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();

        return channelGroupRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(ChannelGroup::getId, ChannelGroup::getName));
    }

    /**
     * Bulk fetch usernames for the lastAiUpdateBy field across the page.
     */
    private Map<Long, String> lookupUsernames(List<Channel> channels) {
        Set<Long> ids = channels.stream()
                .map(Channel::getLastAiUpdateBy)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();

        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(u -> u.getId(), u -> u.getUsername()));
    }

    /**
     * Resolve a list of source names to Source entities.
     * Throws if any source name doesn't exist.
     */
    private Set<Source> resolveSources(List<String> names) {
        if (names == null || names.isEmpty()) return new HashSet<>();

        List<Source> found = sourceRepository.findByNameIn(names);
        if (found.size() != new HashSet<>(names).size()) {
            Set<String> foundNames = found.stream()
                    .map(Source::getName)
                    .collect(Collectors.toSet());
            List<String> missing = names.stream()
                    .filter(n -> !foundNames.contains(n))
                    .distinct()
                    .toList();
            throw new InvalidReferenceException(
                    "Source(s) not found: " + String.join(", ", missing));
        }
        return new HashSet<>(found);
    }

    /**
     * Attach export ID entities to the channel.
     * Rejects duplicate types in the same payload.
     */
    private void attachExportIds(Channel channel, List<ExportIdDto> dtos) {
        if (dtos == null || dtos.isEmpty()) return;

        // Detect duplicates by type within the payload
        Set<ChannelExportId.ExportType> seen = new HashSet<>();
        for (ExportIdDto dto : dtos) {
            if (!seen.add(dto.getType())) {
                throw new InvalidReferenceException(
                        "Duplicate export type in request: " + dto.getType());
            }
        }

        for (ExportIdDto dto : dtos) {
            ChannelExportId entity = ChannelExportId.builder()
                    .channel(channel)
                    .type(dto.getType())
                    .externalId(dto.getExternalId())
                    .build();
            channel.getExportIds().add(entity);
        }
    }
}