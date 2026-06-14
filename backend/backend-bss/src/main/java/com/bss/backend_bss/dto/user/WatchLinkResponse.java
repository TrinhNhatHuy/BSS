package com.bss.backend_bss.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Where to send a USER who clicks "Watch on tv360" for a program.
 *
 * {@code available} is false when the channel has no tv360 mapping (no button
 * should show). {@code kind} is informational:
 *   LIVE     — program is airing now; url deep-links it (with pid)
 *   REPLAY   — program ended but is replayable; url opens catch-up (with pid)
 *   UPCOMING — not started; url opens the live channel
 *   CHANNEL  — no schedule match / not replayable; url opens the live channel
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WatchLinkResponse {
    private boolean available;
    private String url;
    private String kind;
}