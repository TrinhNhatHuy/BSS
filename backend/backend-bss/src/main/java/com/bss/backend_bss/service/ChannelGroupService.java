package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.channel.ChannelGroupResponse;
import com.bss.backend_bss.dto.channel.SourceDto;
import com.bss.backend_bss.repository.ChannelGroupRepository;
import com.bss.backend_bss.repository.SourceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Supporting service for the dropdown endpoints.
 * Tiny, but kept separate from ChannelService to keep that class focused.
 */
@Service
@RequiredArgsConstructor
public class ChannelGroupService {

    private final ChannelGroupRepository channelGroupRepository;
    private final SourceRepository sourceRepository;

    @Transactional(readOnly = true)
    public List<ChannelGroupResponse> listGroups() {
        return channelGroupRepository.findAll().stream()
                .map(g -> ChannelGroupResponse.builder()
                        .id(g.getId())
                        .name(g.getName())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SourceDto> listActiveSources() {
        return sourceRepository.findByStatusTrueOrderByPriorityAscNameAsc().stream()
                .map(s -> SourceDto.builder()
                        .name(s.getName())
                        .url(s.getUrl())
                        .priority(s.getPriority())
                        .status(s.getStatus())
                        .build())
                .toList();
    }
}