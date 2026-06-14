package com.bss.backend_bss.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * Records one implicit interaction for the personalized home page.
 *
 * {@code type} is VIEW | CLICK | WATCH | SEARCH. Program events carry
 * {@code programId} (the server snapshots channel/category/begin_time/name from
 * it); SEARCH events carry {@code keyword} instead. Both are optional here so a
 * malformed body can't break tracking — the service validates per type and simply
 * drops anything it can't use.
 */
@Data
public class LogEventRequest {

    @NotBlank
    @Pattern(regexp = "VIEW|CLICK|WATCH|SEARCH")
    private String type;

    private Long programId;

    private String keyword;
}
