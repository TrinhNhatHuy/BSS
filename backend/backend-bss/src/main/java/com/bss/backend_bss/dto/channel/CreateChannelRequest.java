package com.bss.backend_bss.dto.channel;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * Body of POST /api/editor/channels.
 *
 * Channel ID is uppercase alphanumeric + underscores only (matches seed
 * convention: ANGIANG1, ASIAN_FOOD_CHANNEL_M).
 */
@Data
public class CreateChannelRequest {

    @NotBlank(message = "Channel ID is required")
    @Pattern(regexp = "^[A-Z0-9_]+$",
            message = "Channel ID must be uppercase letters, digits, and underscores only")
    @Size(max = 255, message = "Channel ID must be at most 255 characters")
    private String id;

    @NotBlank(message = "Channel name is required")
    @Size(min = 1, max = 50, message = "Channel name must be 1–50 characters")
    private String name;

    /** Optional. Must reference an existing channel_group.id if provided. */
    private Long channelGroupId;

    /** Optional. Each name must exist in the source table. */
    private List<String> sources;

    /**
     * Optional. Validated element-by-element via @Valid.
     * Service layer rejects duplicate types in the same payload.
     */
    @Valid
    private List<ExportIdDto> exportIds;
}