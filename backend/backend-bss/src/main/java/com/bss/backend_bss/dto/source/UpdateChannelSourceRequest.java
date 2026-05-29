package com.bss.backend_bss.dto.source;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body of PUT /api/editor/channel-sources/{channelId}/{sourceName}.
 *
 * Updates the Source's properties globally. The channel<->source link itself
 * has no editable fields, so editing a row only changes the source's
 * url/priority/status — these changes apply to every channel that uses the
 * source.
 */
@Data
public class UpdateChannelSourceRequest {

    @Size(max = 500, message = "URL must be at most 500 characters")
    private String url;

    @Min(value = 1, message = "Priority must be >= 1")
    private Integer priority;

    private Boolean status;
}