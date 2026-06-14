package com.bss.backend_bss.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Telegram connection state for the current user. When {@code connected} is
 * false, {@code code}/{@code deepLink} let the UI start the linking flow.
 * {@code available} is false if the bot token isn't configured on the server.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TelegramStatusResponse {
    private boolean available;
    private boolean connected;
    private String botUsername;
    private String code;       // one-time link code (null when already connected)
    private String deepLink;   // https://t.me/<bot>?start=<code> (null when connected)
}