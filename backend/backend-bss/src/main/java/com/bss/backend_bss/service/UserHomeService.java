package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.user.HomeFilter;
import com.bss.backend_bss.dto.user.HomeProgramResponse;
import com.bss.backend_bss.dto.user.HomeRailResponse;
import com.bss.backend_bss.dto.user.HomeResponse;
import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.entity.ProgramLabel;
import com.bss.backend_bss.repository.ChannelRepository;
import com.bss.backend_bss.repository.ProgramLabelRepository;
import com.bss.backend_bss.repository.ProgramRepository;
import com.bss.backend_bss.repository.UserBookmarkRepository;
import com.bss.backend_bss.repository.UserPreferenceRepository;
import com.bss.backend_bss.repository.UserReminderRepository;
import com.bss.backend_bss.service.RecommendationService.TasteProfile;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Builds the USER home page: a small, model-labeled slice of today's published
 * (live) schedule, presented as two sections over a single bounded candidate pool
 * of the soonest upcoming programs (labeled lazily via {@link ProgramLabelingService},
 * usually pre-warmed by {@link LabelWarmupScheduler}):
 *
 *   • Top picks for you — ranked by the caller's {@link RecommendationService} taste
 *     profile learned from their behavior (bookmarks/reminders/clicks/watches/
 *     searches), with the onboarding categories as a prior so even brand-new users
 *     get a sensible list.
 *   • Popular — the most-engaged-with programs (global {@link PopularityService}
 *     ranking) restricted to the categories the user chose at onboarding.
 *
 * Plus "Up Next" (the soonest upcoming programs, right-rail list). Programs are
 * de-duplicated across the two sections so the page never repeats a card.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserHomeService {

    private static final ProgramLabel.LabelSource MODEL = ProgramLabel.LabelSource.MODEL_V2;
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    /** How many upcoming programs to consider/label per home load. */
    private static final int POOL_CAP = 500;
    private static final int RAIL_SIZE = 12;
    private static final int UP_NEXT = 6;
    /** Filter view: how many candidates to scan, and how many results to return. */
    private static final int FILTER_CANDIDATES = 800;
    private static final int FILTER_RESULTS = 60;

    /** Soonest-first, null begin times last. */
    private static final Comparator<HomeProgramResponse> BY_BEGIN =
            Comparator.comparing(HomeProgramResponse::getBeginTime,
                    Comparator.nullsLast(Comparator.naturalOrder()));

    private final ProgramRepository programRepository;
    private final ChannelRepository channelRepository;
    private final ProgramLabelRepository programLabelRepository;
    private final UserPreferenceRepository userPreferenceRepository;
    private final UserBookmarkRepository userBookmarkRepository;
    private final UserReminderRepository userReminderRepository;
    private final ProgramLabelingService labelingService;
    private final RecommendationService recommendationService;
    private final PopularityService popularityService;
    private final ZoneId reminderZone;

    @Transactional
    public HomeResponse getHome(Long userId, String dateYyyymmdd, String isoDate) {
        String dayStart = dateYyyymmdd + "000000";
        String dayEnd = dateYyyymmdd + "235959";
        String nowStr = LocalDateTime.now(reminderZone).format(TS);
        // Start the window at "now" when the requested day is the current day.
        String windowStart = (nowStr.compareTo(dayStart) >= 0 && nowStr.compareTo(dayEnd) <= 0) ? nowStr : dayStart;

        List<Program> pool = programRepository
                .findByDraftBatchIdIsNullAndBeginTimeBetweenOrderByBeginTimeAsc(
                        windowStart, dayEnd, PageRequest.of(0, POOL_CAP));
        // Late in the day too few upcoming — widen to the whole day so the page isn't bare.
        if (pool.size() < RAIL_SIZE) {
            pool = programRepository.findByDraftBatchIdIsNullAndBeginTimeBetweenOrderByBeginTimeAsc(
                    dayStart, dayEnd, PageRequest.of(0, POOL_CAP));
        }

        List<HomeProgramResponse> rows = buildRows(userId, pool); // labels (batched) + maps, begin-time order

        List<String> preferences = userPreferenceRepository.findByUserId(userId).stream()
                .map(p -> p.getCategory().name())
                .toList();
        Set<String> prefSet = new HashSet<>(preferences);

        // Sections are built over genuinely-upcoming programs; fall back to the whole
        // pool late in the day so the page isn't empty.
        List<HomeProgramResponse> upcoming = rows.stream()
                .filter(r -> r.getBeginTime() != null && r.getBeginTime().compareTo(nowStr) >= 0)
                .toList();
        List<HomeProgramResponse> base = upcoming.isEmpty() ? rows : upcoming;

        TasteProfile profile = recommendationService.buildProfile(userId);
        boolean cold = recommendationService.isColdStart(profile); // drives the hero subtitle only

        Map<Long, Double> scoreById = scoreMap(base, r -> recommendationService.score(r, profile));
        Map<Long, Double> popById = scoreMap(base, popularityService::popularityScore);

        Set<Long> used = new HashSet<>();
        List<HomeRailResponse> rails = new ArrayList<>();

        // 1. Top picks for you — personalized by behavior (preference prior included).
        List<HomeProgramResponse> top = base.stream()
                .sorted(byMapDesc(scoreById))
                .toList();
        addRail(rails, used, "top_picks", "Top picks for you", true, top);

        // 2. Popular — most-engaged programs within the categories the user chose.
        List<HomeProgramResponse> popular = base.stream()
                .filter(r -> r.getCategory() != null && (prefSet.isEmpty() || prefSet.contains(r.getCategory())))
                .sorted(byMapDesc(popById))
                .toList();
        addRail(rails, used, "popular", "Popular", false, popular);

        List<HomeProgramResponse> upNext = upcoming.stream().limit(UP_NEXT).toList();

        return HomeResponse.builder()
                .date(isoDate)
                .preferences(preferences)
                .personalized(!cold)
                .rails(rails)
                .upNext(upNext)
                .build();
    }

    // --- filtered view (home filter bar) -------------------------------------

    /**
     * Filtered, still-personalized program list for the home filter bar. Applies
     * the program-level filters (date, time range, channel, category, name/content
     * search) in the DB query, then the user-specific filters (bookmarked /
     * reminded) in memory, and ranks the matches by the caller's recommendation
     * score (so it stays "recommended programs, filtered").
     */
    @Transactional
    public List<HomeProgramResponse> getFiltered(Long userId, String dateYyyymmdd, HomeFilter f) {
        String lower = dateYyyymmdd + normTime(f.getTimeStart(), "0000") + "00";
        String upper = dateYyyymmdd + normTime(f.getTimeEnd(), "2359") + "59";
        Program.Category category = parseCategory(f.getCategory());

        Specification<Program> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            ps.add(cb.isNull(root.get("draftBatchId")));
            ps.add(cb.between(root.get("beginTime"), lower, upper));
            if (f.getChannelId() != null && !f.getChannelId().isBlank()) {
                ps.add(cb.equal(root.get("channelId"), f.getChannelId()));
            }
            if (category != null) {
                ps.add(cb.equal(root.get("category"), category));
            }
            if (f.getQ() != null && !f.getQ().isBlank()) {
                String like = "%" + f.getQ().trim().toLowerCase() + "%";
                ps.add(cb.or(
                        cb.like(cb.lower(cb.coalesce(root.get("name"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("content"), "")), like)));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };

        List<Program> programs = programRepository.findAll(spec,
                PageRequest.of(0, FILTER_CANDIDATES, Sort.by(Sort.Direction.ASC, "beginTime"))).getContent();
        if (programs.isEmpty()) return List.of();

        List<HomeProgramResponse> rows = buildRows(userId, programs); // labels + bookmark state

        List<Long> ids = rows.stream().map(HomeProgramResponse::getId).toList();
        Set<Long> reminded = userReminderRepository.findByUserIdAndProgramIdIn(userId, ids).stream()
                .map(r -> r.getProgramId())
                .collect(Collectors.toSet());

        TasteProfile profile = recommendationService.buildProfile(userId);
        return rows.stream()
                .filter(r -> f.getBookmarked() == null || r.isBookmarked() == f.getBookmarked())
                .filter(r -> f.getReminded() == null || reminded.contains(r.getId()) == f.getReminded())
                .sorted(Comparator
                        .comparingDouble((HomeProgramResponse r) -> recommendationService.score(r, profile))
                        .reversed()
                        .thenComparing(BY_BEGIN))
                .limit(FILTER_RESULTS)
                .toList();
    }

    /** "HH:mm" (or "HHmm") → "HHmm"; falls back to {@code def} when blank/invalid. */
    private static String normTime(String t, String def) {
        if (t == null) return def;
        String digits = t.replaceAll("\\D", "");
        return digits.length() == 4 ? digits : def;
    }

    private static Program.Category parseCategory(String name) {
        if (name == null || name.isBlank()) return null;
        try {
            return Program.Category.valueOf(name.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * Add a section of the given items minus anything already used by an earlier
     * section, capped at {@link #RAIL_SIZE}. Skips an empty section.
     */
    private void addRail(List<HomeRailResponse> rails, Set<Long> used, String key, String title,
                         boolean personalized, List<HomeProgramResponse> items) {
        List<HomeProgramResponse> fresh = items.stream()
                .filter(i -> !used.contains(i.getId()))
                .limit(RAIL_SIZE)
                .toList();
        if (fresh.isEmpty()) return;
        fresh.forEach(i -> used.add(i.getId()));
        rails.add(HomeRailResponse.builder()
                .key(key).title(title).reason(null).personalized(personalized).programs(fresh).build());
    }

    // --- channel schedule (USER "View channel" page) --------------------------

    /**
     * One channel's published (live) schedule for a date, labeled by the model and
     * carrying the caller's bookmark state — backs the USER "View channel" page.
     */
    @Transactional
    public List<HomeProgramResponse> getChannelSchedule(Long userId, String channelId, String dateYyyymmdd) {
        List<Program> programs = programRepository
                .findByChannelIdAndDraftBatchIdIsNullAndBeginTimeStartingWithOrderByBeginTimeAsc(
                        channelId, dateYyyymmdd);
        return buildRows(userId, programs);
    }

    // --- row building ---------------------------------------------------------

    /**
     * Lazily label the given programs (batched) then map them to rows enriched with
     * the model's confidence/margin and the caller's bookmark state. Shared by the
     * home page (bounded pool) and the per-channel schedule.
     */
    private List<HomeProgramResponse> buildRows(Long userId, List<Program> programs) {
        labelingService.labelAndPersist(programs);

        Map<String, String> channelNames = lookupChannelNames(programs);

        List<Long> ids = programs.stream().map(Program::getId).toList();
        Map<Long, ProgramLabel> modelLabels = ids.isEmpty() ? Map.of()
                : programLabelRepository.findByProgramIdInAndLabelSource(ids, MODEL).stream()
                .collect(Collectors.toMap(ProgramLabel::getProgramId, l -> l, (a, b) -> a));

        Set<Long> bookmarked = ids.isEmpty() ? Set.of()
                : userBookmarkRepository.findByUserIdAndProgramIdIn(userId, ids).stream()
                .map(b -> b.getProgramId())
                .collect(Collectors.toSet());

        return programs.stream()
                .map(p -> toRow(p, channelNames, modelLabels.get(p.getId()), bookmarked.contains(p.getId())))
                .toList();
    }

    // --- helpers --------------------------------------------------------------

    private static Map<Long, Double> scoreMap(List<HomeProgramResponse> rows, Function<HomeProgramResponse, Double> fn) {
        return rows.stream().collect(Collectors.toMap(HomeProgramResponse::getId, fn, (a, b) -> a));
    }

    private static Comparator<HomeProgramResponse> byMapDesc(Map<Long, Double> scores) {
        return Comparator.comparingDouble((HomeProgramResponse r) -> scores.getOrDefault(r.getId(), 0.0))
                .reversed()
                .thenComparing(BY_BEGIN);
    }

    private HomeProgramResponse toRow(Program p, Map<String, String> channelNames,
                                      ProgramLabel label, boolean bookmarked) {
        return HomeProgramResponse.builder()
                .id(p.getId())
                .channelId(p.getChannelId())
                .channelName(p.getChannelId() == null ? null : channelNames.get(p.getChannelId()))
                .beginTime(p.getBeginTime())
                .endTime(p.getEndTime())
                .name(p.getName())
                .content(p.getContent())
                .category(p.getCategory() == null ? null : p.getCategory().name())
                .confidence(label == null ? null : parseNoteField(label.getNote(), "conf"))
                .margin(label == null ? null : parseNoteField(label.getNote(), "margin"))
                .bookmarked(bookmarked)
                .build();
    }

    private Map<String, String> lookupChannelNames(List<Program> programs) {
        Set<String> ids = programs.stream()
                .map(Program::getChannelId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return channelRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Channel::getId, Channel::getName));
    }

    /** Extract a numeric field from a "conf=..;margin=.." note, or null. */
    private static Double parseNoteField(String note, String key) {
        if (note == null) return null;
        for (String part : note.split(";")) {
            int eq = part.indexOf('=');
            if (eq > 0 && part.substring(0, eq).trim().equals(key)) {
                try {
                    return Double.parseDouble(part.substring(eq + 1).trim());
                } catch (NumberFormatException e) {
                    return null;
                }
            }
        }
        return null;
    }
}