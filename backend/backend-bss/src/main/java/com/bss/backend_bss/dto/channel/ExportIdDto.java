package com.bss.backend_bss.dto.channel;

import com.bss.backend_bss.entity.ChannelExportId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExportIdDto {

    @NotNull(message = "Export type is required")
    private ChannelExportId.ExportType type;

    @NotBlank(message = "External ID is required")
    @Size(max = 100, message = "External ID must be at most 100 characters")
    private String externalId;
}