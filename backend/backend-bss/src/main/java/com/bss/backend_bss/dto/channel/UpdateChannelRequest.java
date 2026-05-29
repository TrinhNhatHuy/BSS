package com.bss.backend_bss.dto.channel;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * Body of PUT /api/editor/channels/{id}.
 *
 * `id` is immutable — taken from the path, not the body.
 * `sources` and `exportIds` use replacement semantics: the provided arrays
 * fully replace the existing ones. Send empty arrays to clear.
 */
@Data
public class UpdateChannelRequest {

    @NotBlank(message = "Channel name is required")
    @Size(min = 1, max = 50, message = "Channel name must be 1–50 characters")
    private String name;

    private Long channelGroupId;

    private List<String> sources;

    @Valid
    private List<ExportIdDto> exportIds;
}