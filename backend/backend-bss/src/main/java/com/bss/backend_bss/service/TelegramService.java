package com.bss.backend_bss.service;

import com.bss.backend_bss.entity.User;
import com.bss.backend_bss.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Free reminder delivery over Telegram. Sending a message is a single HTTPS call
 * to the Bot API — no phone number, no cost.
 *
 * Linking an account uses long polling (getUpdates) instead of a webhook, so it
 * needs no public URL: the user opens a deep link with a one-time code, presses
 * Start, and {@link #pollUpdates()} binds their chat id. Disabled gracefully if
 * no bot token is configured.
 */
@Slf4j
@Service
public class TelegramService {

    private final String botToken;
    private final UserRepository userRepository;

    private RestClient client;
    private String base;                 // https://api.telegram.org/bot<token>
    private volatile String botUsername; // for building deep links
    private Long lastUpdateId;           // getUpdates offset cursor

    public TelegramService(@Value("${app.telegram.bot-token:}") String botToken,
                           UserRepository userRepository) {
        this.botToken = botToken;
        this.userRepository = userRepository;
    }

    @PostConstruct
    void init() {
        if (!isEnabled()) {
            log.warn("Telegram disabled: app.telegram.bot-token not set.");
            return;
        }
        this.client = RestClient.create();
        this.base = "https://api.telegram.org/bot" + botToken;
        try {
            JsonNode me = client.get().uri(base + "/getMe").retrieve().body(JsonNode.class);
            if (me != null && me.path("ok").asBoolean()) {
                this.botUsername = me.path("result").path("username").asText(null);
                log.info("Telegram enabled (bot @{}).", botUsername);
            }
        } catch (Exception e) {
            log.warn("Telegram getMe failed; check the bot token: {}", e.getMessage());
        }
    }

    public boolean isEnabled() {
        return botToken != null && !botToken.isBlank();
    }

    public String getBotUsername() {
        return botUsername;
    }

    /** Send a plain-text message to a chat. Returns false on any failure. */
    public boolean sendMessage(String chatId, String text) {
        if (client == null || chatId == null) return false;
        try {
            JsonNode resp = client.post()
                    .uri(base + "/sendMessage")
                    .body(Map.of("chat_id", chatId, "text", text))
                    .retrieve()
                    .body(JsonNode.class);
            return resp != null && resp.path("ok").asBoolean();
        } catch (Exception e) {
            log.warn("Telegram sendMessage failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Generate (or reuse) the caller's one-time link code and persist it. The
     * frontend turns it into a {@code https://t.me/<bot>?start=<code>} deep link.
     */
    @Transactional
    public String ensureLinkCode(User user) {
        if (user.getTelegramLinkCode() != null && !user.getTelegramLinkCode().isBlank()) {
            return user.getTelegramLinkCode();
        }
        String code = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        user.setTelegramLinkCode(code);
        userRepository.save(user);
        return code;
    }

    // --- long-poll consumer ---------------------------------------------------

    @Scheduled(fixedDelayString = "${app.telegram.poll-ms:3000}")
    void pollUpdates() {
        if (client == null) return;
        try {
            String url = base + "/getUpdates?timeout=0"
                    + (lastUpdateId != null ? "&offset=" + (lastUpdateId + 1) : "");
            JsonNode resp = client.get().uri(url).retrieve().body(JsonNode.class);
            if (resp == null || !resp.path("ok").asBoolean()) return;
            for (JsonNode upd : resp.path("result")) {
                lastUpdateId = upd.path("update_id").asLong();
                handleUpdate(upd);
            }
        } catch (Exception e) {
            log.debug("Telegram getUpdates failed: {}", e.getMessage());
        }
    }

    /** Bind a chat id when a user presses Start with their link code. */
    private void handleUpdate(JsonNode upd) {
        JsonNode msg = upd.path("message");
        if (msg.isMissingNode()) return;

        String text = msg.path("text").asText("");
        String chatId = msg.path("chat").path("id").asText(null);
        if (chatId == null || !text.startsWith("/start")) return;

        String[] parts = text.trim().split("\\s+", 2);
        if (parts.length == 2 && !parts[1].isBlank()) {
            Optional<User> userOpt = userRepository.findByTelegramLinkCode(parts[1].trim());
            if (userOpt.isPresent()) {
                User u = userOpt.get();
                u.setTelegramChatId(chatId);
                u.setTelegramLinkCode(null);
                userRepository.save(u);
                sendMessage(chatId, "✅ Connected! You'll receive BSS program reminders here.");
                return;
            }
        }
        sendMessage(chatId, "Open BSS, set a reminder on a program, and tap “Connect Telegram” to get your personal link.");
    }
}