package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.channel.ChannelFilter;
import com.bss.backend_bss.dto.channel.ChannelResponse;
import com.bss.backend_bss.dto.user.HomeProgramResponse;
import com.bss.backend_bss.dto.user.WatchLinkResponse;
import com.bss.backend_bss.entity.ChannelExportId;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.exception.ResourceNotFoundException;
import com.bss.backend_bss.repository.ChannelExportIdRepository;
import com.bss.backend_bss.repository.ProgramRepository;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.service.ChannelService;
import com.bss.backend_bss.service.Tv360Service;
import com.bss.backend_bss.service.UserHomeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Read-only channel browsing for the USER role (the editor's channel/program
 * endpoints live under /api/editor/** and are off-limits to USER tokens).
 *
 *   GET /api/user/channels                         → paginated list (name/ID search)
 *   GET /api/user/channels/{id}                    → channel detail
 *   GET /api/user/channels/{id}/programs?date=…     → that day's labeled schedule
 *
 * Delegates list/detail to {@link ChannelService} and the schedule to
 * {@link UserHomeService} so USER sees the same model labels + bookmark state as
 * on the home page. Intentionally GET-only: a USER can browse but never mutate
 * channels or programs.
 */
@RestController
@RequestMapping("/api/user/channels")
@RequiredArgsConstructor
public class UserChannelController {

    private static final DateTimeFormatter YYYYMMDD = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final ChannelService channelService;
    private final UserHomeService userHomeService;
    private final ProgramRepository programRepository;
    private final ChannelExportIdRepository channelExportIdRepository;
    private final Tv360Service tv360Service;

    @GetMapping
    public ResponseEntity<Page<ChannelResponse>> list(
            @ModelAttribute ChannelFilter filter,
            @PageableDefault(size = 24, sort = "id", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        return ResponseEntity.ok(channelService.list(filter, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ChannelResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(channelService.getById(id));
    }

    @GetMapping("/{id}/programs")
    public ResponseEntity<List<HomeProgramResponse>> programs(
            @AuthenticationPrincipal CustomUserDetails me,
            @PathVariable String id,
            @RequestParam(required = false) String date
    ) {
        LocalDate target = (date == null || date.isBlank()) ? LocalDate.now() : LocalDate.parse(date);
        return ResponseEntity.ok(
                userHomeService.getChannelSchedule(me.getUser().getId(), id, target.format(YYYYMMDD)));
    }

    /**
     * GET /api/user/channels/{id}/programs/{programId}/watch-link
     *
     * Resolves where to send the user to watch this program on tv360. Returns
     * {@code available=false} when the channel has no TV360 mapping (the UI then
     * hides the "Watch" button). See {@link Tv360Service} for the link rule.
     */
    @GetMapping("/{id}/programs/{programId}/watch-link")
    public ResponseEntity<WatchLinkResponse> watchLink(
            @PathVariable String id,
            @PathVariable Long programId
    ) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> new ResourceNotFoundException("Program not found"));
        if (!id.equals(program.getChannelId()) || program.getDraftBatchId() != null) {
            throw new ResourceNotFoundException("Program not found on this channel");
        }
        WatchLinkResponse link = channelExportIdRepository
                .findByChannel_IdAndType(id, ChannelExportId.ExportType.TV360)
                .map(m -> tv360Service.resolveWatchLink(m.getExternalId(), program.getBeginTime()))
                .orElseGet(() -> WatchLinkResponse.builder().available(false).build());
        return ResponseEntity.ok(link);
    }
}