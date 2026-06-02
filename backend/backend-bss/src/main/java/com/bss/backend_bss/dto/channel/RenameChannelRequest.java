package com.bss.backend_bss.dto.channel;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body of PUT /api/editor/channels/{id}/rename.
 *
 * Changes a channel's primary key. All foreign keys referencing channel(id)
 * are declared ON UPDATE CASCADE, so the rename propagates to programs,
 * reschedule logs, export IDs, sources, etc. automatically.
 *
 * Same ID rules as create: uppercase letters, digits, and underscores only.
 */
@Data
public class RenameChannelRequest {

    @NotBlank(message = "New channel ID is required")
    @Pattern(regexp = "^[A-Z0-9_]+$",
            message = "Channel ID must be uppercase letters, digits, and underscores only")
    @Size(max = 255, message = "Channel ID must be at most 255 characters")
    private String newId;
}
