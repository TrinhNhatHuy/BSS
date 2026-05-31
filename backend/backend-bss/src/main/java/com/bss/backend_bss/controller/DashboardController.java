package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.dashboard.DashboardSummaryResponse;
import com.bss.backend_bss.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Editor Dashboard data.
 *
 *   GET /api/editor/dashboard/summary?range=day|week|month
 *       → per-channel program counts, headline metrics, and recent reschedules
 *         for the selected rolling window. One call backs the whole page; the
 *         frontend re-fetches when the range toggle changes.
 */
@RestController
@RequestMapping("/api/editor/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/summary")
    public ResponseEntity<DashboardSummaryResponse> summary(
            @RequestParam(required = false, defaultValue = "day") String range
    ) {
        return ResponseEntity.ok(dashboardService.getSummary(range));
    }
}