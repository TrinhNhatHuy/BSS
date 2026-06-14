package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.user.HomeProgramResponse;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.entity.UserEvent;
import com.bss.backend_bss.repository.UserBookmarkRepository;
import com.bss.backend_bss.repository.UserEventRepository;
import com.bss.backend_bss.repository.UserPreferenceRepository;
import com.bss.backend_bss.repository.UserReminderRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Content-based recommender for the USER home page.
 *
 * Builds a {@link TasteProfile} from a user's recent behavior — reminders,
 * bookmarks, and {@link UserEvent}s (views/clicks/watches/searches), plus their
 * onboarding category preferences as a standing prior — and scores candidate
 * upcoming programs against it. Four affinity dimensions are learned:
 *
 *   • category   — which of the 7 categories the user engages with
 *   • channel    — which channels they keep coming back to
 *   • time-of-day — when they watch ({@link TimeBucket})
 *   • show name  — recurring shows (normalized name), the strongest signal: the
 *                  same programme airs daily under the same name but a new id.
 *
 * Each signal is weighted by intent (a reminder &gt; a bookmark &gt; a watch &gt;
 * a click &gt; a view) and decayed by age, so recent behavior dominates. The
 * cold-start path (too little history) is handled by {@link PopularityService}.
 *
 * No model training: this is transparent weighted scoring, computed per request
 * from a handful of indexed queries.
 */
@Service
@RequiredArgsConstructor
public class RecommendationService {

    /** How far back to look when building a profile. */
    static final int LOOKBACK_DAYS = 45;
    /** Exponential decay scale in days: weight *= exp(-ageDays / TAU). */
    private static final double DECAY_TAU_DAYS = 21.0;
    /** Below this much total signal we treat the user as cold-start. */
    private static final double MIN_STRENGTH = 5.0;

    // Per-signal base weights (intent strength).
    private static final double W_REMINDER = 4.0;
    private static final double W_BOOKMARK = 3.0;
    private static final double W_WATCH = 2.5;
    private static final double W_CLICK = 1.5;
    private static final double W_VIEW = 1.0;
    private static final double W_SEARCH = 1.0;
    private static final double W_PREFERENCE = 2.0; // onboarding prior, no decay

    // Per-dimension scoring weights (applied to max-normalized affinities, 0..1).
    private static final double S_CATEGORY = 1.0;
    private static final double S_CHANNEL = 0.8;
    private static final double S_TIME = 0.5;
    private static final double S_NAME = 2.0;
    private static final double S_CONFIDENCE = 0.3;

    private final UserEventRepository userEventRepository;
    private final UserBookmarkRepository userBookmarkRepository;
    private final UserReminderRepository userReminderRepository;
    private final UserPreferenceRepository userPreferenceRepository;

    // --- profile building -----------------------------------------------------

    @Transactional(readOnly = true)
    public TasteProfile buildProfile(Long userId) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime since = now.minusDays(LOOKBACK_DAYS);
        TasteProfile profile = new TasteProfile();

        // Onboarding preferences — a standing prior on categories (no decay).
        userPreferenceRepository.findByUserId(userId).forEach(pref ->
                profile.addCategory(pref.getCategory(), W_PREFERENCE));

        // Reminders + bookmarks: [category, channelId, name, beginTime, createTime].
        for (Object[] row : userReminderRepository.findProfileRows(userId, since)) {
            applyProfileRow(profile, row, W_REMINDER, now);
        }
        for (Object[] row : userBookmarkRepository.findProfileRows(userId, since)) {
            applyProfileRow(profile, row, W_BOOKMARK, now);
        }

        // Implicit events (already carry snapshot columns).
        for (UserEvent e : userEventRepository.findByUserIdAndCreateTimeGreaterThanEqual(userId, since)) {
            double base = baseWeight(e.getEventType());
            if (base <= 0) continue;
            double w = base * decay(e.getCreateTime(), now);
            if (e.getCategory() != null) profile.addCategory(e.getCategory(), w);
            if (e.getChannelId() != null) profile.addChannel(e.getChannelId(), w);
            TimeBucket b = timeBucket(e.getBeginTime());
            if (b != null) profile.addTimeBucket(b, w);
            // SEARCH events have no program — learn from the keyword instead.
            String nameSignal = e.getEventType() == UserEvent.EventType.SEARCH ? e.getKeyword() : e.getProgramName();
            String norm = normalizeShowName(nameSignal);
            if (norm != null) profile.addShowName(norm, w);
        }

        profile.finish();
        return profile;
    }

    private void applyProfileRow(TasteProfile profile, Object[] row, double base, LocalDateTime now) {
        Program.Category category = (Program.Category) row[0];
        String channelId = (String) row[1];
        String name = (String) row[2];
        String beginTime = (String) row[3];
        LocalDateTime createTime = (LocalDateTime) row[4];

        double w = base * decay(createTime, now);
        if (category != null) profile.addCategory(category, w);
        if (channelId != null) profile.addChannel(channelId, w);
        TimeBucket b = timeBucket(beginTime);
        if (b != null) profile.addTimeBucket(b, w);
        String norm = normalizeShowName(name);
        if (norm != null) profile.addShowName(norm, w);
    }

    private static double baseWeight(UserEvent.EventType type) {
        if (type == null) return 0;
        return switch (type) {
            case WATCH -> W_WATCH;
            case CLICK -> W_CLICK;
            case VIEW -> W_VIEW;
            case SEARCH -> W_SEARCH;
        };
    }

    /** exp(-ageDays / TAU); 1.0 when the timestamp is missing. */
    private static double decay(LocalDateTime when, LocalDateTime now) {
        if (when == null) return 1.0;
        double ageDays = Math.max(0, Duration.between(when, now).toHours() / 24.0);
        return Math.exp(-ageDays / DECAY_TAU_DAYS);
    }

    // --- scoring --------------------------------------------------------------

    public boolean isColdStart(TasteProfile profile) {
        return profile == null || profile.totalStrength < MIN_STRENGTH;
    }

    /** Personalized score for a candidate against the profile (higher = better). */
    public double score(HomeProgramResponse p, TasteProfile profile) {
        double catAff = profile.categoryAffinity(parseCategory(p.getCategory()));
        double chanAff = profile.channelAffinity(p.getChannelId());
        double timeAff = profile.timeAffinity(timeBucket(p.getBeginTime()));
        double nameAff = showNameAffinity(p.getName(), profile);
        double conf = p.getConfidence() == null ? 0.0 : p.getConfidence();

        return S_CATEGORY * catAff
                + S_CHANNEL * chanAff
                + S_TIME * timeAff
                + S_NAME * nameAff
                + S_CONFIDENCE * conf;
    }

    /**
     * 0..1 affinity for a candidate name against the shows/keywords the user has
     * engaged with: exact normalized match = full, substring overlap = half. Takes
     * the best single match (not a sum) so a generic keyword can't dominate.
     */
    public double showNameAffinity(String name, TasteProfile profile) {
        String norm = normalizeShowName(name);
        if (norm == null || profile.nameMax <= 0) return 0.0;
        double best = 0.0;
        for (Map.Entry<String, Double> e : profile.showNameWeights.entrySet()) {
            String key = e.getKey();
            double sim;
            if (norm.equals(key)) {
                sim = 1.0;
            } else if (key.length() >= 3 && norm.length() >= 3 && (norm.contains(key) || key.contains(norm))) {
                sim = 0.5;
            } else {
                continue;
            }
            best = Math.max(best, sim * (e.getValue() / profile.nameMax));
        }
        return best;
    }

    // --- static helpers (also reused by the home assembly) --------------------

    /**
     * Normalize a programme name so the same show matches across days: lowercase,
     * strip episode/date markers ("Tập 12", "- 3", "(2026...)", trailing numbers),
     * collapse whitespace. Returns null for blank input.
     */
    public static String normalizeShowName(String name) {
        if (name == null) return null;
        String s = name.toLowerCase().trim();
        s = s.replaceAll("\\(.*?\\)", " ");                 // (2026), (HD), …
        s = s.replaceAll("(?:tập|tap|so|số|phần|phan|ep|episode|kỳ|ky)\\s*\\d+.*$", " ");
        s = s.replaceAll("[\\-–_/|:]+\\s*\\d+\\s*$", " ");   // trailing "- 12"
        s = s.replaceAll("\\d{1,4}\\s*$", " ");               // trailing bare numbers
        s = s.replaceAll("\\s+", " ").trim();
        return s.isEmpty() ? null : s;
    }

    /** Bucket a YYYYMMDDHHMMSS start time by hour, or null if unparseable. */
    public static TimeBucket timeBucket(String beginTime) {
        if (beginTime == null || beginTime.length() < 10) return null;
        int hour;
        try {
            hour = Integer.parseInt(beginTime.substring(8, 10));
        } catch (NumberFormatException e) {
            return null;
        }
        if (hour < 0 || hour > 23) return null;
        if (hour >= 5 && hour < 11) return TimeBucket.MORNING;
        if (hour >= 11 && hour < 14) return TimeBucket.MIDDAY;
        if (hour >= 14 && hour < 18) return TimeBucket.AFTERNOON;
        if (hour >= 18 && hour < 22) return TimeBucket.PRIMETIME;
        return TimeBucket.LATE;
    }

    private static Program.Category parseCategory(String name) {
        if (name == null) return null;
        try {
            return Program.Category.valueOf(name);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public enum TimeBucket { MORNING, MIDDAY, AFTERNOON, PRIMETIME, LATE }

    // --- the learned profile --------------------------------------------------

    /**
     * A user's accumulated affinities. Weights are raw sums while building; after
     * {@link #finish()} the per-dimension maxes are cached so affinities can be
     * max-normalized to 0..1 for comparable, weighted scoring.
     */
    @Getter
    public static class TasteProfile {
        private final Map<Program.Category, Double> categoryWeights = new EnumMap<>(Program.Category.class);
        private final Map<String, Double> channelWeights = new HashMap<>();
        private final Map<TimeBucket, Double> timeBucketWeights = new EnumMap<>(TimeBucket.class);
        private final Map<String, Double> showNameWeights = new HashMap<>();
        private double totalStrength = 0.0;

        private double catMax, chanMax, timeMax, nameMax;

        void addCategory(Program.Category c, double w) { add(categoryWeights, c, w); }
        void addChannel(String c, double w) { add(channelWeights, c, w); }
        void addTimeBucket(TimeBucket b, double w) { add(timeBucketWeights, b, w); }
        void addShowName(String n, double w) { add(showNameWeights, n, w); }

        private <K> void add(Map<K, Double> map, K key, double w) {
            if (key == null || w <= 0) return;
            map.merge(key, w, Double::sum);
            totalStrength += w;
        }

        void finish() {
            catMax = max(categoryWeights);
            chanMax = max(channelWeights);
            timeMax = max(timeBucketWeights);
            nameMax = max(showNameWeights);
        }

        double categoryAffinity(Program.Category c) {
            return c == null || catMax <= 0 ? 0.0 : categoryWeights.getOrDefault(c, 0.0) / catMax;
        }

        double channelAffinity(String channelId) {
            return channelId == null || chanMax <= 0 ? 0.0 : channelWeights.getOrDefault(channelId, 0.0) / chanMax;
        }

        double timeAffinity(TimeBucket b) {
            return b == null || timeMax <= 0 ? 0.0 : timeBucketWeights.getOrDefault(b, 0.0) / timeMax;
        }

        /** The user's single strongest category, or null. */
        public Program.Category topCategory() {
            return categoryWeights.entrySet().stream()
                    .max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(null);
        }

        /** The user's top {@code n} channel ids by affinity (strongest first). */
        public List<String> topChannels(int n) {
            return channelWeights.entrySet().stream()
                    .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                    .limit(n).map(Map.Entry::getKey).toList();
        }

        private static <K> double max(Map<K, Double> map) {
            return map.values().stream().mapToDouble(Double::doubleValue).max().orElse(0.0);
        }
    }

    /** Comparator used by callers to rank candidates by personalized score (desc). */
    public Comparator<HomeProgramResponse> byScore(TasteProfile profile) {
        return Comparator.comparingDouble((HomeProgramResponse p) -> score(p, profile)).reversed();
    }
}
