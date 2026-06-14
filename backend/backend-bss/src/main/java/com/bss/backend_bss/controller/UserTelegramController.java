package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.user.TelegramStatusResponse;
import com.bss.backend_bss.entity.User;
import com.bss.backend_bss.exception.ResourceNotFoundException;
import com.bss.backend_bss.repository.UserRepository;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.service.TelegramService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/**
 * Telegram linking for reminder delivery.
 *
 *   GET  /api/user/telegram/status     → connection state + a deep link to connect
 *   POST /api/user/telegram/disconnect → forget the linked chat
 *
 * Actual binding happens server-side when the user presses Start on the bot
 * (see TelegramService long-poll consumer).
 */
@RestController
@RequestMapping("/api/user/telegram")
@RequiredArgsConstructor
public class UserTelegramController {

    private final TelegramService telegramService;
    private final UserRepository userRepository;

    @GetMapping("/status")
    @Transactional
    public ResponseEntity<TelegramStatusResponse> status(@AuthenticationPrincipal CustomUserDetails me) {
        User user = userRepository.findById(me.getUser().getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        boolean available = telegramService.isEnabled();
        boolean connected = user.getTelegramChatId() != null && !user.getTelegramChatId().isBlank();
        String botUsername = telegramService.getBotUsername();

        String code = null;
        String deepLink = null;
        if (available && !connected) {
            code = telegramService.ensureLinkCode(user);
            if (botUsername != null) {
                deepLink = "https://t.me/" + botUsername + "?start=" + code;
            }
        }

        return ResponseEntity.ok(TelegramStatusResponse.builder()
                .available(available)
                .connected(connected)
                .botUsername(botUsername)
                .code(code)
                .deepLink(deepLink)
                .build());
    }

    @PostMapping("/disconnect")
    @Transactional
    public ResponseEntity<Void> disconnect(@AuthenticationPrincipal CustomUserDetails me) {
        User user = userRepository.findById(me.getUser().getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setTelegramChatId(null);
        user.setTelegramLinkCode(null);
        userRepository.save(user);
        return ResponseEntity.noContent().build();
    }
}