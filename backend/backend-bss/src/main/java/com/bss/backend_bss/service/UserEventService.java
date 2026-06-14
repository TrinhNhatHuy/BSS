package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.user.LogEventRequest;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.entity.UserEvent;
import com.bss.backend_bss.repository.ProgramRepository;
import com.bss.backend_bss.repository.UserEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Records a user's implicit interactions into {@code user_event}.
 *
 * Best-effort by design: anything malformed (unknown type, missing/unknown
 * program, blank keyword) is logged at debug and dropped rather than thrown, so
 * client-side tracking can never break the page. For program events we snapshot
 * the program's channel/category/begin_time/name (a cheap PK lookup) so the
 * signal survives the per-airing rotation of program rows.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserEventService {

    private static final int KEYWORD_MAX = 255;
    private static final int NAME_MAX = 500;

    private final UserEventRepository userEventRepository;
    private final ProgramRepository programRepository;

    @Transactional
    public void record(Long userId, LogEventRequest req) {
        UserEvent.EventType type = parseType(req.getType());
        if (type == null) return;

        UserEvent.UserEventBuilder event = UserEvent.builder().userId(userId).eventType(type);

        if (type == UserEvent.EventType.SEARCH) {
            String keyword = req.getKeyword() == null ? null : req.getKeyword().trim();
            if (keyword == null || keyword.isEmpty()) return; // nothing to learn from
            event.keyword(truncate(keyword, KEYWORD_MAX));
        } else {
            // Program-centric event — snapshot the program so the signal outlives it.
            if (req.getProgramId() == null) return;
            Program p = programRepository.findById(req.getProgramId()).orElse(null);
            if (p == null) {
                log.debug("Dropping {} event: unknown program {}", type, req.getProgramId());
                return;
            }
            event.programId(p.getId())
                    .channelId(p.getChannelId())
                    .category(p.getCategory())
                    .beginTime(p.getBeginTime())
                    .programName(truncate(p.getName(), NAME_MAX));
        }

        userEventRepository.save(event.build());
    }

    // --- helpers --------------------------------------------------------------

    private static UserEvent.EventType parseType(String type) {
        if (type == null) return null;
        try {
            return UserEvent.EventType.valueOf(type.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
