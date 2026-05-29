package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.source.ChannelSourceResponse;
import com.bss.backend_bss.dto.source.CreateChannelSourceRequest;
import com.bss.backend_bss.dto.source.UpdateChannelSourceRequest;
import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.Source;
import com.bss.backend_bss.exception.DuplicateResourceException;
import com.bss.backend_bss.exception.ResourceNotFoundException;
import com.bss.backend_bss.repository.ChannelRepository;
import com.bss.backend_bss.repository.SourceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Backs the Manage > Sources page.
 *
 * Each row in that page is a (channel, source) pair. URL / priority / status
 * live on the Source entity globally, so editing one row may visibly change
 * other rows that share the same source — that's intentional and consistent
 * with the DB schema (no per-link priority column).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChannelSourceService {

    private final ChannelRepository channelRepository;
    private final SourceRepository sourceRepository;

    @Transactional(readOnly = true)
    public List<ChannelSourceResponse> listAll() {
        List<ChannelSourceResponse> rows = new ArrayList<>();
        for (Channel channel : channelRepository.findAll()) {
            for (Source source : channel.getSources()) {
                rows.add(toResponse(channel, source));
            }
        }
        rows.sort(Comparator
                .comparing(ChannelSourceResponse::getChannelId)
                .thenComparing(r -> r.getPriority() == null ? Integer.MAX_VALUE : r.getPriority())
                .thenComparing(ChannelSourceResponse::getSourceName));
        return rows;
    }

    @Transactional
    public ChannelSourceResponse create(CreateChannelSourceRequest req) {
        Channel channel = channelRepository.findById(req.getChannelId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Channel not found: " + req.getChannelId()));

        Source existing = sourceRepository.findById(req.getSourceName()).orElse(null);
        final Source source;
        if (existing == null) {
            source = sourceRepository.save(Source.builder()
                    .name(req.getSourceName())
                    .url(req.getUrl())
                    .priority(req.getPriority())
                    .status(req.getStatus() != null ? req.getStatus() : Boolean.TRUE)
                    .build());
            log.info("Created source '{}'", source.getName());
        } else {
            source = existing;
        }

        boolean alreadyLinked = channel.getSources().stream()
                .anyMatch(s -> s.getName().equals(source.getName()));
        if (alreadyLinked) {
            throw new DuplicateResourceException(
                    "Source '" + source.getName() + "' is already linked to channel '"
                            + channel.getId() + "'");
        }
        channel.getSources().add(source);
        channelRepository.save(channel);
        log.info("Linked source '{}' to channel '{}'", source.getName(), channel.getId());

        return toResponse(channel, source);
    }

    @Transactional
    public ChannelSourceResponse update(String channelId, String sourceName,
                                        UpdateChannelSourceRequest req) {
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Channel not found: " + channelId));

        Source source = channel.getSources().stream()
                .filter(s -> s.getName().equals(sourceName))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Source '" + sourceName + "' is not linked to channel '"
                                + channelId + "'"));

        if (req.getUrl() != null) source.setUrl(req.getUrl());
        if (req.getPriority() != null) source.setPriority(req.getPriority());
        if (req.getStatus() != null) source.setStatus(req.getStatus());

        sourceRepository.save(source);
        log.info("Updated source '{}' (touched from channel '{}')", sourceName, channelId);

        return toResponse(channel, source);
    }

    @Transactional
    public void delete(String channelId, String sourceName) {
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Channel not found: " + channelId));

        boolean removed = channel.getSources().removeIf(s -> s.getName().equals(sourceName));
        if (!removed) {
            throw new ResourceNotFoundException(
                    "Source '" + sourceName + "' is not linked to channel '" + channelId + "'");
        }
        channelRepository.save(channel);
        log.info("Unlinked source '{}' from channel '{}'", sourceName, channelId);

        // If no other channels reference this source, drop the source itself
        // so the global list stays tidy. Safe because the schema cascades
        // channel_source rows on source delete.
        List<Channel> stillUsing = channelRepository.findBySourceName(sourceName);
        if (stillUsing.isEmpty()) {
            sourceRepository.deleteById(sourceName);
            log.info("Deleted orphan source '{}'", sourceName);
        }
    }

    private ChannelSourceResponse toResponse(Channel channel, Source source) {
        return ChannelSourceResponse.builder()
                .channelId(channel.getId())
                .channelName(channel.getName())
                .sourceName(source.getName())
                .url(source.getUrl())
                .priority(source.getPriority())
                .status(source.getStatus())
                .build();
    }
}