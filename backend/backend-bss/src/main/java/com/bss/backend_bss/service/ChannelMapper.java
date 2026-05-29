package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.channel.ChannelResponse;
import com.bss.backend_bss.dto.channel.ExportIdDto;
import com.bss.backend_bss.dto.channel.SourceDto;
import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.ChannelExportId;
import com.bss.backend_bss.entity.Source;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Converts Channel entity to ChannelResponse DTO.
 *
 * The "lookup" maps (channelGroupNames, usernames) are passed in by the service
 * — the service does ONE bulk fetch for the whole page, then calls toResponse()
 * per channel. This avoids the N+1 query problem on list endpoints.
 */
@Component
public class ChannelMapper {

    public ChannelResponse toResponse(
            Channel channel,
            Map<Long, String> channelGroupNames,
            Map<Long, String> usernamesById
    ) {
        return ChannelResponse.builder()
                .id(channel.getId())
                .name(channel.getName())
                .channelGroupId(channel.getChannelGroupId())
                .channelGroupName(
                        channel.getChannelGroupId() == null
                                ? null
                                : channelGroupNames.get(channel.getChannelGroupId())
                )
                .exportIds(mapExportIds(channel.getExportIds()))
                .sources(mapSources(channel.getSources()))
                .numberOfReschedules(channel.getNumberOfReschedules())
                .aiUpdateStatus(channel.getAiUpdateStatus())
                .lastAiUpdateTime(channel.getLastAiUpdateTime())
                .lastAiUpdateBy(channel.getLastAiUpdateBy())
                .lastAiUpdateByUsername(
                        channel.getLastAiUpdateBy() == null
                                ? null
                                : usernamesById.get(channel.getLastAiUpdateBy())
                )
                .createTime(channel.getCreateTime())
                .updateTime(channel.getUpdateTime())
                .build();
    }

    private List<ExportIdDto> mapExportIds(java.util.Set<ChannelExportId> entities) {
        if (entities == null) return List.of();
        return entities.stream()
                .sorted(Comparator.comparing(ChannelExportId::getType))
                .map(e -> ExportIdDto.builder()
                        .type(e.getType())
                        .externalId(e.getExternalId())
                        .build())
                .toList();
    }

    private List<SourceDto> mapSources(java.util.Set<Source> entities) {
        if (entities == null) return List.of();
        return entities.stream()
                .sorted(Comparator
                        .comparing(Source::getPriority,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(Source::getName))
                .map(s -> SourceDto.builder()
                        .name(s.getName())
                        .url(s.getUrl())
                        .priority(s.getPriority())
                        .status(s.getStatus())
                        .build())
                .toList();
    }
}