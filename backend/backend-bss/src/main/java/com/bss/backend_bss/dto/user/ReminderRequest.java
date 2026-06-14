package com.bss.backend_bss.dto.user;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * Create/update a reminder for a program. {@code minutesBefore} is how long
 * before the program starts to notify (0 = at start). {@code channel} is one of
 * WEBPUSH | TELEGRAM | BOTH.
 */
@Data
public class ReminderRequest {

    @NotNull
    private Long programId;

    @NotNull
    @Min(0)
    @Max(1440) // at most 24h before
    private Integer minutesBefore;

    @NotNull
    @Pattern(regexp = "WEBPUSH|TELEGRAM|BOTH")
    private String channel;
}