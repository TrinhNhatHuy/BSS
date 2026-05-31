package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.dashboard.DashboardSummaryResponse;
import com.bss.backend_bss.dto.reschedulelog.RescheduleLogFilter;
import com.bss.backend_bss.dto.reschedulelog.RescheduleLogResponse;
import com.bss.backend_bss.repository.ChannelRepository;
import com.bss.backend_bss.repository.ProgramRepository;
import com.bss.backend_bss.repository.RescheduleLogRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Aggregates the Editor Dashboard figures in one read-only pass.
 *
 * Date windows are rolling and driven by {@code range}:
 *   day   → today
 *   week  → last 7 days  (today-6 .. today)
 *   month → last 30 days (today-29 .. today)
 *
 * begin_time is a fixed-width YYYYMMDDHHMMSS string that sorts chronologically
 * as text, so the window is applied as a lexical >= / <= comparison against
 * YYYYMMDD000000 / YYYYMMDD235959 prefixes — the same approach
 * ProgramSpecifications uses, which lets the queries ride the existing indexes.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter YYYYMMDD = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final ChannelRepository channelRepository;
    private final ProgramRepository programRepository;
    private final RescheduleLogRepository rescheduleLogRepository;
    private final RescheduleLogService rescheduleLogService;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional(readOnly = true)
    public DashboardSummaryResponse getSummary(String range) {
        LocalDate today = LocalDate.now();
        String normalized = normalizeRange(range);

        LocalDate from = switch (normalized) {
            case "week"  -> today.minusDays(6);
            case "month" -> today.minusDays(29);
            default      -> today;                 // "day"
        };
        LocalDate to = today;

        String fromPrefix = from.format(YYYYMMDD) + "000000";
        String toPrefix   = to.format(YYYYMMDD) + "235959";

        // Per-channel live-program counts in the window (powers chart + status list).
        List<DashboardSummaryResponse.ChannelProgramCount> programsByChannel =
                buildProgramsByChannel(fromPrefix, toPrefix);

        long schedulesReady = programsByChannel.stream().filter(c -> c.getPrograms() > 0).count();
        long crawlFailures  = programsByChannel.size() - schedulesReady;

        DashboardSummaryResponse.Metrics metrics = DashboardSummaryResponse.Metrics.builder()
                .schedulesReady(schedulesReady)
                .crawlFailures(crawlFailures)
                .pendingReview(countPendingDraftBatches())
                .reschedules(rescheduleLogRepository.countInDateRange(fromPrefix, toPrefix))
                .build();

        return DashboardSummaryResponse.builder()
                .range(normalized)
                .dateFrom(from.format(ISO))
                .dateTo(to.format(ISO))
                .totalChannels(programsByChannel.size())
                .metrics(metrics)
                .programsByChannel(programsByChannel)
                .recentReschedules(recentReschedules())
                .build();
    }

    /**
     * Every channel with its live-program count in the window. Channels with no
     * programs are included with count 0 (LEFT-merge against the full channel
     * list), so the chart shows all channels and the failures metric is honest.
     * Sorted by count descending, then name.
     */
    private List<DashboardSummaryResponse.ChannelProgramCount> buildProgramsByChannel(
            String fromPrefix, String toPrefix) {

        Map<String, Long> counts = new HashMap<>();
        for (Object[] row : programRepository.countLiveByChannelInRange(fromPrefix, toPrefix)) {
            counts.put((String) row[0], (Long) row[1]);
        }

        return channelRepository.findAll().stream()
                .map(ch -> DashboardSummaryResponse.ChannelProgramCount.builder()
                        .channelId(ch.getId())
                        .channelName(ch.getName())
                        .programs(counts.getOrDefault(ch.getId(), 0L))
                        .build())
                .sorted(Comparator
                        .comparingLong(DashboardSummaryResponse.ChannelProgramCount::getPrograms).reversed()
                        .thenComparing(DashboardService::safeName))
                .toList();
    }

    private static String safeName(DashboardSummaryResponse.ChannelProgramCount c) {
        return c.getChannelName() != null ? c.getChannelName() : c.getChannelId();
    }

    /** Draft batches still awaiting approval. Read straight off the table — there is no JPA entity for draft_batch. */
    private long countPendingDraftBatches() {
        Object result = entityManager
                .createNativeQuery("SELECT COUNT(*) FROM draft_batch WHERE status <> 'APPROVED'")
                .getSingleResult();
        return ((Number) result).longValue();
    }

    /** Six newest reschedule-log rows for the activity feed (id is a monotonic serial → newest-first). */
    private List<RescheduleLogResponse> recentReschedules() {
        return rescheduleLogService.list(
                new RescheduleLogFilter(),
                PageRequest.of(0, 6, Sort.by(Sort.Direction.DESC, "id"))
        ).getContent();
    }

    private static String normalizeRange(String range) {
        if (range == null) return "day";
        String r = range.trim().toLowerCase();
        return switch (r) {
            case "week", "month" -> r;
            default -> "day";
        };
    }
}