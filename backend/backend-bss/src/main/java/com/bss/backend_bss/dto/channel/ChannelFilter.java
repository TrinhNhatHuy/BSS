package com.bss.backend_bss.dto.channel;

import com.bss.backend_bss.entity.ChannelExportId;
import lombok.Data;

/**
 * Query parameters for GET /api/editor/channels.
 *
 * Spring MVC binds query params to this object automatically via @ModelAttribute.
 * All fields are nullable — null means "don't filter on this".
 *
 * Special value: channelGroupId = -1L means "channels with no group" (since
 * passing literal `null` in a query string is awkward). The frontend sends
 * `?channelGroupId=-1` for the "no group" filter.
 */
@Data
public class ChannelFilter {

    private String id;
    private String name;

    /**
     * Single-box search that matches the channel id OR the name (case-insensitive
     * substring). Backs the search input on the Manage > Channels page. Kept
     * separate from {@link #id}/{@link #name}, which AND-combine for precise
     * column filtering.
     */
    private String search;

    private Long channelGroupId;

    private ChannelExportId.ExportType exportType;
    private String exportId;

    private Integer sourcePriority;
    private String sourceName;
}