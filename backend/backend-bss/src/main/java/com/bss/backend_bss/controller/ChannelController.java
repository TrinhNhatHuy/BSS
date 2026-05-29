package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.channel.*;
import com.bss.backend_bss.service.ChannelService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Editor-only channel management endpoints.
 *
 * Path /api/editor/** is locked to EDITOR role by SecurityConfig.
 *
 * The controller is intentionally thin — request/response mapping and HTTP
 * status decisions only. All business logic is in ChannelService.
 */
@RestController
@RequestMapping("/api/editor/channels")
@RequiredArgsConstructor
public class ChannelController {

    private final ChannelService channelService;

    /**
     * GET /api/editor/channels
     *
     * @ModelAttribute binds query params to ChannelFilter fields by name.
     * @PageableDefault sets default page=0, size=20, sort=id,asc.
     *
     * Spring resolves ?sort=name,desc automatically into the Pageable.
     */
    @GetMapping
    public ResponseEntity<Page<ChannelResponse>> list(
            @ModelAttribute ChannelFilter filter,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        return ResponseEntity.ok(channelService.list(filter, pageable));
    }

    /**
     * GET /api/editor/channels/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ChannelResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(channelService.getById(id));
    }

    /**
     * POST /api/editor/channels
     */
    @PostMapping
    public ResponseEntity<ChannelResponse> create(@Valid @RequestBody CreateChannelRequest request) {
        ChannelResponse response = channelService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * PUT /api/editor/channels/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<ChannelResponse> update(
            @PathVariable String id,
            @Valid @RequestBody UpdateChannelRequest request
    ) {
        return ResponseEntity.ok(channelService.update(id, request));
    }

    /**
     * DELETE /api/editor/channels/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        channelService.delete(id);
        return ResponseEntity.noContent().build();
    }
}