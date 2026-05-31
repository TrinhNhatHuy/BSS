package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.program.ProgramFilter;
import com.bss.backend_bss.dto.program.ProgramResponse;
import com.bss.backend_bss.dto.program.UpdateProgramRequest;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.service.ProgramService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Editor-only program endpoints.
 *
 *   GET /api/editor/programs                  → paginated, filterable index (Manage > Programs)
 *   GET /api/editor/programs/by-channel       → live schedule for one channel on one date (ViewChannel)
 *   GET /api/editor/programs/categories       → enum values for the category dropdown
 */
@RestController
@RequestMapping("/api/editor/programs")
@RequiredArgsConstructor
public class ProgramController {

    private static final DateTimeFormatter YYYYMMDD = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final ProgramService programService;

    /**
     * Paginated search. Sort defaults to begin_time ascending; pass
     * ?sort=beginTime,desc to flip, or sort=name,asc / sort=channelId,asc, etc.
     */
    @GetMapping
    public ResponseEntity<Page<ProgramResponse>> list(
            @ModelAttribute ProgramFilter filter,
            @PageableDefault(size = 20, sort = "beginTime", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        return ResponseEntity.ok(programService.list(filter, pageable));
    }

    /**
     * Live (non-draft) schedule for one channel on one date.
     * `date` is ISO yyyy-MM-dd. Defaults to today if omitted.
     */
    @GetMapping("/by-channel")
    public ResponseEntity<List<ProgramResponse>> listForChannel(
            @RequestParam String channelId,
            @RequestParam(required = false) String date
    ) {
        LocalDate target = (date == null || date.isBlank())
                ? LocalDate.now()
                : LocalDate.parse(date);
        return ResponseEntity.ok(programService.listForChannelOnDate(channelId, target.format(YYYYMMDD)));
    }

    /** Single program by id — backs the program detail page. */
    @GetMapping("/{id}")
    public ResponseEntity<ProgramResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(programService.getById(id));
    }

    /** Edit a program (name, content, category, times) from the detail page. */
    @PutMapping("/{id}")
    public ResponseEntity<ProgramResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateProgramRequest request
    ) {
        return ResponseEntity.ok(programService.update(id, request));
    }

    /** Permanently delete a program from the detail page. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        programService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Category enum values, for the index-page filter dropdown. */
    @GetMapping("/categories")
    public ResponseEntity<List<String>> categories() {
        return ResponseEntity.ok(
                java.util.Arrays.stream(Program.Category.values()).map(Enum::name).toList()
        );
    }
}