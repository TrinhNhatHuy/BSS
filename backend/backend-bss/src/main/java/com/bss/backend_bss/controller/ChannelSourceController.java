package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.source.ChannelSourceResponse;
import com.bss.backend_bss.dto.source.CreateChannelSourceRequest;
import com.bss.backend_bss.dto.source.UpdateChannelSourceRequest;
import com.bss.backend_bss.service.ChannelSourceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Editor-only endpoints powering the Manage > Sources page.
 *
 * Each row exposed here is a (channel, source) pair. Source-level fields
 * (url, priority, status) live on the Source entity globally — there is no
 * per-link override.
 */
@RestController
@RequestMapping("/api/editor/channel-sources")
@RequiredArgsConstructor
public class ChannelSourceController {

    private final ChannelSourceService channelSourceService;

    @GetMapping
    public ResponseEntity<List<ChannelSourceResponse>> list() {
        return ResponseEntity.ok(channelSourceService.listAll());
    }

    @PostMapping
    public ResponseEntity<ChannelSourceResponse> create(
            @Valid @RequestBody CreateChannelSourceRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(channelSourceService.create(request));
    }

    @PutMapping("/{channelId}/{sourceName}")
    public ResponseEntity<ChannelSourceResponse> update(
            @PathVariable String channelId,
            @PathVariable String sourceName,
            @Valid @RequestBody UpdateChannelSourceRequest request
    ) {
        return ResponseEntity.ok(channelSourceService.update(channelId, sourceName, request));
    }

    @DeleteMapping("/{channelId}/{sourceName}")
    public ResponseEntity<Void> delete(
            @PathVariable String channelId,
            @PathVariable String sourceName
    ) {
        channelSourceService.delete(channelId, sourceName);
        return ResponseEntity.noContent().build();
    }
}