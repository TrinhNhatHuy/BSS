package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.draft.DraftBatchDetailResponse;
import com.bss.backend_bss.dto.draft.DraftBatchResponse;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.service.DraftBatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Editor-only AI draft-batch endpoints — the review side of "Clean with AI".
 * The n8n "AI Controller" workflow creates the batches + cleaned programs; here
 * the editor lists, reviews, deletes, and approves them.
 *
 *   GET    /api/editor/draft-batches?channelId=…   → pending batches for a channel
 *   GET    /api/editor/draft-batches/{id}          → one batch + its cleaned programs
 *   DELETE /api/editor/draft-batches/{id}          → drop the whole draft (cascades to programs)
 *   POST   /api/editor/draft-batches/{id}/approve  → replace the live day with the cleaned schedule
 *
 * Individual draft programs are reviewed/edited/removed through the existing
 * /api/editor/programs/{id} endpoints, which operate on any program by id.
 */
@RestController
@RequestMapping("/api/editor/draft-batches")
@RequiredArgsConstructor
public class DraftBatchController {

    private final DraftBatchService draftBatchService;

    /**
     * Pending draft batches. With {@code channelId} → just that channel
     * (ViewChannel panel); without it → every channel (the Drafts by AI page).
     */
    @GetMapping
    public ResponseEntity<List<DraftBatchResponse>> list(
            @RequestParam(required = false) String channelId) {
        return ResponseEntity.ok(
                channelId == null || channelId.isBlank()
                        ? draftBatchService.listAll()
                        : draftBatchService.listForChannel(channelId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DraftBatchDetailResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(draftBatchService.getDetail(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        draftBatchService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<Void> approve(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails me
    ) {
        draftBatchService.approve(id, me.getUser().getId());
        return ResponseEntity.noContent().build();
    }
}