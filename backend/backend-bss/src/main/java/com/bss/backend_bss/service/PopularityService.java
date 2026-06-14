package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.user.HomeProgramResponse;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.repository.UserBookmarkRepository;
import com.bss.backend_bss.repository.UserEventRepository;
import com.bss.backend_bss.repository.UserReminderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Global "popular with viewers" signal: how much ALL users engage with each
 * category, channel, and (normalized) show, aggregated over the recent window.
 *
 * It backs two things — the everyone-sees-it "Popular with viewers" rail and the
 * cold-start ranking for users with too little history of their own. Because it is
 * user-independent and a touch heavier (it spans every user's bookmarks, reminders
 * and events), it is computed OFF the request path on a schedule and cached in a
 * {@code volatile} snapshot, mirroring {@link LabelWarmupScheduler}.
 *
 * Popularity is intentionally coarse: events count equally (no per-type weighting),
 * while bookmarks and reminders — the explicit "I like this" signals — count more.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopularityService {

    // Source weights (explicit "like" signals outweigh implicit engagement).
    private static final double SRC_EVENT = 1.0;
    private static final double SRC_BOOKMARK = 3.0;
    private static final double SRC_REMINDER = 4.0;

    // Per-dimension scoring weights (applied to max-normalized popularity, 0..1).
    private static final double P_CATEGORY = 1.0;
    private static final double P_CHANNEL = 0.6;
    private static final double P_NAME = 2.0;
    private static final double P_CONFIDENCE = 0.3;

    private final UserEventRepository userEventRepository;
    private final UserBookmarkRepository userBookmarkRepository;
    private final UserReminderRepository userReminderRepository;

    private volatile Snapshot snapshot = Snapshot.empty();

    /** Recompute shortly after boot, then every 30 minutes (non-overlapping). */
    @Scheduled(initialDelay = 20_000, fixedDelay = 1_800_000)
    @Transactional(readOnly = true)
    public void refresh() {
        try {
            LocalDateTime since = LocalDateTime.now().minusDays(RecommendationService.LOOKBACK_DAYS);

            Map<Program.Category, Double> cat = new HashMap<>();
            mergeCategory(cat, userEventRepository.popularityByCategory(since), SRC_EVENT);
            mergeCategory(cat, userBookmarkRepository.popularityByCategory(since), SRC_BOOKMARK);
            mergeCategory(cat, userReminderRepository.popularityByCategory(since), SRC_REMINDER);

            Map<String, Double> chan = new HashMap<>();
            mergeKey(chan, userEventRepository.popularityByChannel(since), SRC_EVENT, false);
            mergeKey(chan, userBookmarkRepository.popularityByChannel(since), SRC_BOOKMARK, false);
            mergeKey(chan, userReminderRepository.popularityByChannel(since), SRC_REMINDER, false);

            Map<String, Double> name = new HashMap<>();
            mergeKey(name, userEventRepository.popularityByName(since), SRC_EVENT, true);
            mergeKey(name, userBookmarkRepository.popularityByName(since), SRC_BOOKMARK, true);
            mergeKey(name, userReminderRepository.popularityByName(since), SRC_REMINDER, true);

            snapshot = new Snapshot(cat, chan, name);
            log.info("Popularity refreshed: {} categories, {} channels, {} shows.",
                    cat.size(), chan.size(), name.size());
        } catch (Exception e) {
            log.warn("Popularity refresh skipped: {}", e.getMessage());
        }
    }

    /** 0..1-ish popularity score for a candidate (category + channel + show + conf). */
    public double popularityScore(HomeProgramResponse p) {
        Snapshot s = snapshot;
        double catPop = s.categoryAffinity(parseCategory(p.getCategory()));
        double chanPop = s.channelAffinity(p.getChannelId());
        double namePop = s.nameAffinity(p.getName());
        double conf = p.getConfidence() == null ? 0.0 : p.getConfidence();
        return P_CATEGORY * catPop + P_CHANNEL * chanPop + P_NAME * namePop + P_CONFIDENCE * conf;
    }

    /** True once a non-empty snapshot exists (there is some global behavior to rank by). */
    public boolean hasData() {
        return snapshot.totalWeight > 0;
    }

    // --- merge helpers --------------------------------------------------------

    private static void mergeCategory(Map<Program.Category, Double> into, List<Object[]> rows, double weight) {
        for (Object[] r : rows) {
            Program.Category key = (Program.Category) r[0];
            long count = ((Number) r[1]).longValue();
            if (key != null) into.merge(key, count * weight, Double::sum);
        }
    }

    private static void mergeKey(Map<String, Double> into, List<Object[]> rows, double weight, boolean normalizeName) {
        for (Object[] r : rows) {
            String key = (String) r[0];
            if (normalizeName) key = RecommendationService.normalizeShowName(key);
            if (key == null) continue;
            long count = ((Number) r[1]).longValue();
            into.merge(key, count * weight, Double::sum);
        }
    }

    private static Program.Category parseCategory(String name) {
        if (name == null) return null;
        try {
            return Program.Category.valueOf(name);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Immutable, max-normalized popularity maps. */
    private static final class Snapshot {
        private final Map<Program.Category, Double> category;
        private final Map<String, Double> channel;
        private final Map<String, Double> name;
        private final double catMax, chanMax, nameMax, totalWeight;

        Snapshot(Map<Program.Category, Double> category, Map<String, Double> channel, Map<String, Double> name) {
            this.category = category;
            this.channel = channel;
            this.name = name;
            this.catMax = max(category);
            this.chanMax = max(channel);
            this.nameMax = max(name);
            this.totalWeight = sum(category) + sum(channel) + sum(name);
        }

        static Snapshot empty() {
            return new Snapshot(Map.of(), Map.of(), Map.of());
        }

        double categoryAffinity(Program.Category c) {
            return c == null || catMax <= 0 ? 0.0 : category.getOrDefault(c, 0.0) / catMax;
        }

        double channelAffinity(String channelId) {
            return channelId == null || chanMax <= 0 ? 0.0 : channel.getOrDefault(channelId, 0.0) / chanMax;
        }

        double nameAffinity(String programName) {
            String norm = RecommendationService.normalizeShowName(programName);
            return norm == null || nameMax <= 0 ? 0.0 : name.getOrDefault(norm, 0.0) / nameMax;
        }

        private static double max(Map<?, Double> m) {
            return m.values().stream().mapToDouble(Double::doubleValue).max().orElse(0.0);
        }

        private static double sum(Map<?, Double> m) {
            return m.values().stream().mapToDouble(Double::doubleValue).sum();
        }
    }
}
