package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.user.ReminderRequest;
import com.bss.backend_bss.dto.user.ReminderResponse;
import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.entity.UserReminder;
import com.bss.backend_bss.exception.InvalidReferenceException;
import com.bss.backend_bss.exception.ResourceNotFoundException;
import com.bss.backend_bss.repository.ChannelRepository;
import com.bss.backend_bss.repository.ProgramRepository;
import com.bss.backend_bss.repository.UserReminderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Create/update/list/delete a user's program reminders.
 *
 * {@code remindAt} is computed once at save time from the program's start
 * (YYYYMMDDHHMMSS, local Vietnam wall-clock) minus {@code minutesBefore}, in the
 * configured reminder zone — so the scheduler can compare it directly against a
 * zone-pinned "now".
 */
@Slf4j
@Service
public class ReminderService {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final UserReminderRepository reminderRepository;
    private final ProgramRepository programRepository;
    private final ChannelRepository channelRepository;
    private final ZoneId zone;

    public ReminderService(UserReminderRepository reminderRepository,
                           ProgramRepository programRepository,
                           ChannelRepository channelRepository,
                           ZoneId reminderZone) {
        this.reminderRepository = reminderRepository;
        this.programRepository = programRepository;
        this.channelRepository = channelRepository;
        this.zone = reminderZone;
    }

    @Transactional
    public ReminderResponse upsert(Long userId, ReminderRequest req) {
        Program program = programRepository.findById(req.getProgramId())
                .orElseThrow(() -> new ResourceNotFoundException("Program not found: " + req.getProgramId()));

        LocalDateTime start = parseStart(program.getBeginTime());
        if (start == null) {
            throw new InvalidReferenceException("This program has no valid start time.");
        }
        if (!start.isAfter(LocalDateTime.now(zone))) {
            throw new InvalidReferenceException("This program has already started.");
        }

        UserReminder reminder = reminderRepository
                .findByUserIdAndProgramId(userId, req.getProgramId())
                .orElseGet(() -> UserReminder.builder()
                        .userId(userId)
                        .programId(req.getProgramId())
                        .build());

        reminder.setMinutesBefore(req.getMinutesBefore());
        reminder.setChannel(UserReminder.Channel.valueOf(req.getChannel()));
        reminder.setRemindAt(start.minusMinutes(req.getMinutesBefore()));
        reminder.setIsSent(false); // re-arm if the user edits an already-sent reminder

        reminderRepository.save(reminder);
        return toResponse(reminder, program, channelNameMap(program));
    }

    @Transactional(readOnly = true)
    public Optional<ReminderResponse> get(Long userId, Long programId) {
        return reminderRepository.findByUserIdAndProgramId(userId, programId)
                .map(r -> {
                    Program p = programRepository.findById(programId).orElse(null);
                    return toResponse(r, p, p == null ? Map.of() : channelNameMap(p));
                });
    }

    @Transactional(readOnly = true)
    public List<ReminderResponse> list(Long userId) {
        List<UserReminder> reminders = reminderRepository.findByUserIdOrderByRemindAtAsc(userId);
        if (reminders.isEmpty()) return List.of();

        List<Long> programIds = reminders.stream().map(UserReminder::getProgramId).toList();
        Map<Long, Program> programs = programRepository.findAllById(programIds).stream()
                .collect(Collectors.toMap(Program::getId, p -> p));

        Set<String> channelIds = programs.values().stream()
                .map(Program::getChannelId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<String, String> channelNames = channelIds.isEmpty() ? Map.of()
                : channelRepository.findAllById(channelIds).stream()
                .collect(Collectors.toMap(Channel::getId, Channel::getName));

        return reminders.stream()
                .map(r -> toResponse(r, programs.get(r.getProgramId()), channelNames))
                .toList();
    }

    @Transactional
    public void delete(Long userId, Long programId) {
        reminderRepository.deleteByUserIdAndProgramId(userId, programId);
    }

    // --- helpers --------------------------------------------------------------

    private Map<String, String> channelNameMap(Program p) {
        if (p.getChannelId() == null) return Map.of();
        return channelRepository.findById(p.getChannelId())
                .map(c -> Map.of(c.getId(), c.getName()))
                .orElse(Map.of());
    }

    private ReminderResponse toResponse(UserReminder r, Program p, Map<String, String> channelNames) {
        return ReminderResponse.builder()
                .programId(r.getProgramId())
                .minutesBefore(r.getMinutesBefore())
                .channel(r.getChannel().name())
                .remindAt(r.getRemindAt() == null ? null : r.getRemindAt().toString())
                .sent(Boolean.TRUE.equals(r.getIsSent()))
                .programName(p == null ? null : p.getName())
                .beginTime(p == null ? null : p.getBeginTime())
                .channelName(p == null || p.getChannelId() == null ? null : channelNames.get(p.getChannelId()))
                .build();
    }

    /** Parse a 14-char YYYYMMDDHHMMSS into a local date-time, or null if malformed. */
    static LocalDateTime parseStart(String beginTime) {
        if (beginTime == null || beginTime.length() < 14) return null;
        try {
            return LocalDateTime.parse(beginTime.substring(0, 14), TS);
        } catch (Exception e) {
            return null;
        }
    }
}