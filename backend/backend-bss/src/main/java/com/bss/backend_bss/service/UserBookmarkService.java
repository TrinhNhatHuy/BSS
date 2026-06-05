package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.user.BookmarkResponse;
import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.entity.UserBookmark;
import com.bss.backend_bss.exception.ResourceNotFoundException;
import com.bss.backend_bss.repository.ChannelRepository;
import com.bss.backend_bss.repository.ProgramRepository;
import com.bss.backend_bss.repository.UserBookmarkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Save / unsave programs for a user, and list their bookmarks (newest first) for
 * the home page right rail. Channel names are bulk-resolved in one query.
 */
@Service
@RequiredArgsConstructor
public class UserBookmarkService {

    private final UserBookmarkRepository bookmarkRepository;
    private final ProgramRepository programRepository;
    private final ChannelRepository channelRepository;

    @Transactional(readOnly = true)
    public List<BookmarkResponse> list(Long userId) {
        List<UserBookmark> bookmarks = bookmarkRepository.findByUserIdOrderByCreateTimeDesc(userId);
        if (bookmarks.isEmpty()) return List.of();

        List<Long> programIds = bookmarks.stream().map(UserBookmark::getProgramId).toList();
        Map<Long, Program> programs = programRepository.findAllById(programIds).stream()
                .collect(Collectors.toMap(Program::getId, p -> p));

        Set<String> channelIds = programs.values().stream()
                .map(Program::getChannelId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, String> channelNames = channelIds.isEmpty() ? Map.of()
                : channelRepository.findAllById(channelIds).stream()
                .collect(Collectors.toMap(Channel::getId, Channel::getName));

        List<BookmarkResponse> out = new ArrayList<>();
        for (UserBookmark bm : bookmarks) {
            Program p = programs.get(bm.getProgramId());
            if (p == null) continue; // program was deleted since bookmarking
            out.add(BookmarkResponse.builder()
                    .programId(p.getId())
                    .channelId(p.getChannelId())
                    .channelName(p.getChannelId() == null ? null : channelNames.get(p.getChannelId()))
                    .beginTime(p.getBeginTime())
                    .endTime(p.getEndTime())
                    .name(p.getName())
                    .content(p.getContent())
                    .category(p.getCategory() == null ? null : p.getCategory().name())
                    .build());
        }
        return out;
    }

    @Transactional
    public void add(Long userId, Long programId) {
        if (!programRepository.existsById(programId)) {
            throw new ResourceNotFoundException("Program not found: " + programId);
        }
        if (bookmarkRepository.existsByUserIdAndProgramId(userId, programId)) {
            return; // idempotent
        }
        bookmarkRepository.save(UserBookmark.builder()
                .userId(userId)
                .programId(programId)
                .build());
    }

    @Transactional
    public void remove(Long userId, Long programId) {
        bookmarkRepository.deleteByUserIdAndProgramId(userId, programId);
    }
}