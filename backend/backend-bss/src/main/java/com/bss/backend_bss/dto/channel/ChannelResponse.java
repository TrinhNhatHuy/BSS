package com.bss.backend_bss.dto.channel;

import com.bss.backend_bss.entity.Channel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Returned by:
 *   GET /api/editor/channels (list rows)
 *   GET /api/editor/channels/{id} (detail page)
 *   POST/PUT /api/editor/channels (after create/update)
 *
 * One DTO covers both list and detail for simplicity. If detail-specific fields
 * grow (program count, recent reschedule count, etc.), split into ChannelListDto
 * and ChannelDetailDto.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChannelResponse {

    private String id;
    private String name;

    private Long channelGroupId;
    /** Resolved in the service layer (channel_group.name). Null if no group. */
    private String channelGroupName;

    private List<ExportIdDto> exportIds;
    private List<SourceDto> sources;

    private Integer numberOfReschedules;
    private Channel.AiUpdateStatus aiUpdateStatus;
    private LocalDateTime lastAiUpdateTime;
    private Long lastAiUpdateBy;
    /** Resolved in the service layer (users.username). Null if no AI update yet. */
    private String lastAiUpdateByUsername;

    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}