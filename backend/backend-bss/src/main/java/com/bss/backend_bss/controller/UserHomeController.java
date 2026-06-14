package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.user.HomeFilter;
import com.bss.backend_bss.dto.user.HomeProgramResponse;
import com.bss.backend_bss.dto.user.HomeResponse;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.service.UserHomeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;

/**
 * USER home page endpoints (any authenticated user). The user id comes from the
 * JWT principal so the response is always personalized to the caller.
 *
 *   GET /api/user/home?date=yyyy-MM-dd  → today's labeled schedule + preferences
 *   GET /api/user/categories            → the 7 category enum values (chip list)
 */
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserHomeController {

    private static final DateTimeFormatter YYYYMMDD = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final UserHomeService userHomeService;
    private final ZoneId reminderZone;

    @GetMapping("/home")
    public ResponseEntity<HomeResponse> home(
            @AuthenticationPrincipal CustomUserDetails me,
            @RequestParam(required = false) String date
    ) {
        // Default "today" in the program/reminder zone (containers run UTC).
        LocalDate target = (date == null || date.isBlank()) ? LocalDate.now(reminderZone) : LocalDate.parse(date);
        return ResponseEntity.ok(
                userHomeService.getHome(me.getUser().getId(), target.format(YYYYMMDD), target.toString()));
    }

    /**
     * GET /api/user/home/filter — the home filter bar. Returns a personalized,
     * recommendation-ranked program list for the chosen date matching the given
     * filters (category, channel, bookmarked/reminded, time range, name/content).
     */
    @GetMapping("/home/filter")
    public ResponseEntity<List<HomeProgramResponse>> filter(
            @AuthenticationPrincipal CustomUserDetails me,
            @ModelAttribute HomeFilter filter
    ) {
        LocalDate target = (filter.getDate() == null || filter.getDate().isBlank())
                ? LocalDate.now(reminderZone) : LocalDate.parse(filter.getDate());
        return ResponseEntity.ok(
                userHomeService.getFiltered(me.getUser().getId(), target.format(YYYYMMDD), filter));
    }

    @GetMapping("/categories")
    public ResponseEntity<List<String>> categories() {
        return ResponseEntity.ok(
                Arrays.stream(Program.Category.values()).map(Enum::name).toList());
    }
}