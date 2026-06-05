package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.reschedulelog.RescheduleLogFilter;
import com.bss.backend_bss.dto.reschedulelog.RescheduleLogResponse;
import com.bss.backend_bss.entity.RescheduleLog;
import com.bss.backend_bss.service.RescheduleLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

/**
 * Editor-only reschedule-log endpoints (Manage > Reschedule Logs).
 *
 *   GET /api/editor/reschedule-logs           → paginated, filterable index
 *   GET /api/editor/reschedule-logs/statuses  → enum values for the status dropdown
 *   GET /api/editor/reschedule-logs/{id}      → a single log, for the detail page
 */
@RestController
@RequestMapping("/api/editor/reschedule-logs")
@RequiredArgsConstructor
public class RescheduleLogController {

    private final RescheduleLogService rescheduleLogService;

    /**
     * Paginated search. Sort defaults to id descending — the id is a monotonic
     * BIGSERIAL, so this reliably yields newest-first even for the bulk-ingested
     * rows whose create_time was never populated. Pass ?sort=createTime,desc to
     * order by timestamp instead.
     */
    @GetMapping
    public ResponseEntity<Page<RescheduleLogResponse>> list(
            @ModelAttribute RescheduleLogFilter filter,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(rescheduleLogService.list(filter, pageable));
    }

    /** Status enum values, for the index-page filter dropdown. */
    @GetMapping("/statuses")
    public ResponseEntity<List<String>> statuses() {
        return ResponseEntity.ok(
                Arrays.stream(RescheduleLog.Status.values()).map(Enum::name).toList()
        );
    }

    /**
     * A single reschedule log by id, for the change-detail page. Returns 404 if
     * no such log exists. (Declared after /statuses so that literal path never
     * binds to {id}.)
     */
    @GetMapping("/{id}")
    public ResponseEntity<RescheduleLogResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(rescheduleLogService.getById(id));
    }
}