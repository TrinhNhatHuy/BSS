package com.bss.backend_bss.dto.source;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Flat row for the Manage > Sources page.
 *
 * One row per (channel, source) pairing. URL/priority/status come from the
 * Source entity, which is global — so if two channels share a source, both
 * rows show the same URL/priority/status.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChannelSourceResponse {
    private String channelId;
    private String channelName;
    private String sourceName;
    private String url;
    private Integer priority;
    private Boolean status;
}