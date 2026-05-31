package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.channel.ChannelGroupResponse;
import com.bss.backend_bss.dto.channel.SourceDto;
import com.bss.backend_bss.service.ChannelGroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Endpoints that populate dropdowns and pickers in the editor UI.
 * Kept separate from ChannelController so /channels stays focused on channel CRUD.
 */
@RestController
@RequestMapping("/api/editor")
@RequiredArgsConstructor
public class ChannelGroupController {

    private final ChannelGroupService channelGroupService;

    /** GET /api/editor/channel-groups */
    @GetMapping("/channel-groups")
    public ResponseEntity<List<ChannelGroupResponse>> listGroups() {
        return ResponseEntity.ok(channelGroupService.listGroups());
    }

    /** GET /api/editor/sources */
    @GetMapping("/sources")
    public ResponseEntity<List<SourceDto>> listSources() {
        return ResponseEntity.ok(channelGroupService.listActiveSources());
    }

    // NOTE: GET /api/editor/channels/export-types lives in ChannelController
    // (grouped with channel CRUD). Defining it here too caused an ambiguous
    // mapping that broke application startup.
}