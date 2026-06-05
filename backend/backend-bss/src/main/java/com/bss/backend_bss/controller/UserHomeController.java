package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.user.HomeResponse;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.service.UserHomeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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

    @GetMapping("/home")
    public ResponseEntity<HomeResponse> home(
            @AuthenticationPrincipal CustomUserDetails me,
            @RequestParam(required = false) String date
    ) {
        LocalDate target = (date == null || date.isBlank()) ? LocalDate.now() : LocalDate.parse(date);
        return ResponseEntity.ok(
                userHomeService.getHome(me.getUser().getId(), target.format(YYYYMMDD), target.toString()));
    }

    @GetMapping("/categories")
    public ResponseEntity<List<String>> categories() {
        return ResponseEntity.ok(
                Arrays.stream(Program.Category.values()).map(Enum::name).toList());
    }
}