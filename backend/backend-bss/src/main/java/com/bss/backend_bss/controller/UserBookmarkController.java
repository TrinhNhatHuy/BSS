package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.user.BookmarkResponse;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.service.UserBookmarkService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * The caller's bookmarked programs (right-rail "Bookmarked Programs").
 *
 *   GET    /api/user/bookmarks             → list (newest first)
 *   POST   /api/user/bookmarks/{programId} → save (idempotent)
 *   DELETE /api/user/bookmarks/{programId} → unsave
 */
@RestController
@RequestMapping("/api/user/bookmarks")
@RequiredArgsConstructor
public class UserBookmarkController {

    private final UserBookmarkService userBookmarkService;

    @GetMapping
    public ResponseEntity<List<BookmarkResponse>> list(@AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(userBookmarkService.list(me.getUser().getId()));
    }

    @PostMapping("/{programId}")
    public ResponseEntity<Void> add(
            @AuthenticationPrincipal CustomUserDetails me,
            @PathVariable Long programId
    ) {
        userBookmarkService.add(me.getUser().getId(), programId);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{programId}")
    public ResponseEntity<Void> remove(
            @AuthenticationPrincipal CustomUserDetails me,
            @PathVariable Long programId
    ) {
        userBookmarkService.remove(me.getUser().getId(), programId);
        return ResponseEntity.noContent().build();
    }
}