package com.bss.backend_bss.service;

import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.entity.PushSubscription;
import com.bss.backend_bss.entity.User;
import com.bss.backend_bss.entity.UserReminder;
import com.bss.backend_bss.repository.ChannelRepository;
import com.bss.backend_bss.repository.ProgramRepository;
import com.bss.backend_bss.repository.PushSubscriptionRepository;
import com.bss.backend_bss.repository.UserReminderRepository;
import com.bss.backend_bss.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Polls for due reminders once a minute and delivers them over the user's chosen
 * channel(s). "Now" is pinned to the reminder zone so it lines up with the
 * wall-clock {@code remind_at} computed at save time.
 */
@Slf4j
@Service
public class ReminderScheduler {

    private final UserReminderRepository reminderRepository;
    private final PushSubscriptionRepository pushRepository;
    private final ProgramRepository programRepository;
    private final ChannelRepository channelRepository;
    private final UserRepository userRepository;
    private final WebPushService webPushService;
    private final TelegramService telegramService;
    private final ObjectMapper objectMapper;
    private final ZoneId zone;

    public ReminderScheduler(UserReminderRepository reminderRepository,
                             PushSubscriptionRepository pushRepository,
                             ProgramRepository programRepository,
                             ChannelRepository channelRepository,
                             UserRepository userRepository,
                             WebPushService webPushService,
                             TelegramService telegramService,
                             ObjectMapper objectMapper,
                             ZoneId reminderZone) {
        this.reminderRepository = reminderRepository;
        this.pushRepository = pushRepository;
        this.programRepository = programRepository;
        this.channelRepository = channelRepository;
        this.userRepository = userRepository;
        this.webPushService = webPushService;
        this.telegramService = telegramService;
        this.objectMapper = objectMapper;
        this.zone = reminderZone;
    }

    @Scheduled(fixedDelayString = "${app.reminder.poll-ms:60000}")
    @Transactional
    public void fireDueReminders() {
        LocalDateTime now = LocalDateTime.now(zone);
        List<UserReminder> due = reminderRepository.findByIsSentFalseAndRemindAtLessThanEqual(now);
        if (due.isEmpty()) return;

        // Bulk-load the programs + channel names referenced by this batch.
        List<Long> programIds = due.stream().map(UserReminder::getProgramId).toList();
        Map<Long, Program> programs = programRepository.findAllById(programIds).stream()
                .collect(Collectors.toMap(Program::getId, p -> p));
        Set<String> channelIds = programs.values().stream()
                .map(Program::getChannelId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<String, String> channelNames = channelIds.isEmpty() ? Map.of()
                : channelRepository.findAllById(channelIds).stream()
                .collect(Collectors.toMap(Channel::getId, Channel::getName));

        int sent = 0;
        for (UserReminder r : due) {
            Program p = programs.get(r.getProgramId());
            LocalDateTime start = p == null ? null : ReminderService.parseStart(p.getBeginTime());
            // Skip delivery if the program is gone or already started (e.g. after
            // downtime) — but still mark handled so it doesn't linger in the queue.
            if (p != null && start != null && start.isAfter(now)) {
                dispatch(r, p, channelNames.get(p.getChannelId()));
                sent++;
            }
            r.setIsSent(true);
        }
        reminderRepository.saveAll(due);
        if (sent > 0) log.info("Fired {} reminder(s).", sent);
    }

    private void dispatch(UserReminder r, Program p, String channelName) {
        String name = (p.getName() == null || p.getName().isBlank()) ? "Your program" : p.getName();
        String when = r.getMinutesBefore() == 0
                ? "Starting now"
                : "Starts in " + r.getMinutesBefore() + " min";
        String at = hhmm(p.getBeginTime());
        String body = when + (channelName != null ? " on " + channelName : "") + " (at " + at + ")";
        String url = p.getChannelId() != null ? "/user/channels/" + p.getChannelId() : "/user/home";

        UserReminder.Channel ch = r.getChannel();
        if (ch == UserReminder.Channel.WEBPUSH || ch == UserReminder.Channel.BOTH) {
            sendWebPush(r.getUserId(), "🔔 " + name, body, url);
        }
        if (ch == UserReminder.Channel.TELEGRAM || ch == UserReminder.Channel.BOTH) {
            sendTelegram(r.getUserId(), "🔔 " + name + "\n" + body);
        }
    }

    private void sendWebPush(Long userId, String title, String body, String url) {
        if (!webPushService.isEnabled()) return;
        List<PushSubscription> subs = pushRepository.findByUserId(userId);
        if (subs.isEmpty()) return;

        String payload;
        try {
            payload = objectMapper.writeValueAsString(Map.of(
                    "title", title, "body", body, "url", url, "tag", "bss-reminder"));
        } catch (Exception e) {
            payload = "{\"title\":\"BSS Reminder\"}";
        }
        for (PushSubscription s : subs) {
            boolean keep = webPushService.send(s, payload);
            if (!keep) pushRepository.deleteByEndpoint(s.getEndpoint());
        }
    }

    private void sendTelegram(Long userId, String text) {
        if (!telegramService.isEnabled()) return;
        userRepository.findById(userId)
                .map(User::getTelegramChatId)
                .filter(id -> id != null && !id.isBlank())
                .ifPresent(chatId -> telegramService.sendMessage(chatId, text));
    }

    private static String hhmm(String beginTime) {
        return (beginTime != null && beginTime.length() >= 12)
                ? beginTime.substring(8, 10) + ":" + beginTime.substring(10, 12)
                : "--:--";
    }
}