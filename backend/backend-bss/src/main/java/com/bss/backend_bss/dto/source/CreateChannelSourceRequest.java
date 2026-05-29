package com.bss.backend_bss.dto.source;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body of POST /api/editor/channel-sources.
 *
 * Creates the Source globally (if it doesn't already exist) and links it to
 * the given channel. If the source already exists, the link is added without
 * touching the source's url/priority/status — use PUT to modify those.
 */
@Data
public class CreateChannelSourceRequest {

    @NotBlank(message = "Channel ID is required")
    private String channelId;

    @NotBlank(message = "Source name is required")
    @Size(max = 50, message = "Source name must be at most 50 characters")
    private String sourceName;

    @Size(max = 500, message = "URL must be at most 500 characters")
    private String url;

    @Min(value = 1, message = "Priority must be >= 1")
    private Integer priority;

    private Boolean status;
}