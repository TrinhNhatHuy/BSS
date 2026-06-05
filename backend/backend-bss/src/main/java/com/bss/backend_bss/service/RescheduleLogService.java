package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.reschedulelog.RescheduleLogFilter;
import com.bss.backend_bss.dto.reschedulelog.RescheduleLogResponse;
import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.RescheduleLog;
import com.bss.backend_bss.exception.ResourceNotFoundException;
import com.bss.backend_bss.repository.ChannelRepository;
import com.bss.backend_bss.repository.RescheduleLogRepository;
import com.bss.backend_bss.specification.RescheduleLogSpecifications;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RescheduleLogService {

    private final RescheduleLogRepository rescheduleLogRepository;
    private final ChannelRepository channelRepository;

    /**
     * Paginated, filterable reschedule-log list for the editor index page.
     *
     * Channel names are bulk-resolved in one extra query (not per-row), the same
     * pattern ProgramService / ChannelService use.
     */
    @Transactional(readOnly = true)
    public Page<RescheduleLogResponse> list(RescheduleLogFilter filter, Pageable pageable) {
        Page<RescheduleLog> page = rescheduleLogRepository.findAll(
                RescheduleLogSpecifications.build(filter),
                pageable
        );

        Map<String, String> channelNames = lookupChannelNames(page.getContent());
        return page.map(log -> toResponse(log, channelNames));
    }

    /**
     * A single reschedule-log entry, for the change-detail page. Resolves the
     * channel name the same way the list does (one lookup), and 404s if the id
     * doesn't exist.
     */
    @Transactional(readOnly = true)
    public RescheduleLogResponse getById(Long id) {
        RescheduleLog log = rescheduleLogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reschedule log not found: " + id));
        Map<String, String> channelNames = lookupChannelNames(List.of(log));
        return toResponse(log, channelNames);
    }

    private Map<String, String> lookupChannelNames(List<RescheduleLog> logs) {
        Set<String> ids = logs.stream()
                .map(RescheduleLog::getChannelId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();

        return channelRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Channel::getId, Channel::getName));
    }

    private RescheduleLogResponse toResponse(RescheduleLog log, Map<String, String> channelNames) {
        return RescheduleLogResponse.builder()
                .id(log.getId())
                .channelId(log.getChannelId())
                .channelName(log.getChannelId() == null ? null : channelNames.get(log.getChannelId()))
                .status(log.getStatus())
                .beginTime(log.getBeginTime())
                .endTime(log.getEndTime())
                .name(log.getName())
                .content(log.getContent())
                .originalBeginTime(log.getOriginalBeginTime())
                .originalEndTime(log.getOriginalEndTime())
                .originalName(log.getOriginalName())
                .originalContent(log.getOriginalContent())
                .createTime(log.getCreateTime())
                .updateTime(log.getUpdateTime())
                .build();
    }
}