package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.user.HomeProgramResponse;
import com.bss.backend_bss.dto.user.HomeResponse;
import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.entity.ProgramLabel;
import com.bss.backend_bss.repository.ChannelRepository;
import com.bss.backend_bss.repository.ProgramLabelRepository;
import com.bss.backend_bss.repository.ProgramRepository;
import com.bss.backend_bss.repository.UserBookmarkRepository;
import com.bss.backend_bss.repository.UserPreferenceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Builds the USER home page: a given day's published (live) schedule, labeled by
 * the model and personalized with the caller's preferences and bookmarks.
 *
 * Lazy labeling: any program for the day with no category yet is sent to the ML
 * service in one batch; the prediction is persisted to {@code program.category}
 * and a MODEL_V2 {@code program_label} row (so the next view of that day is
 * instant). If the ML service is unreachable, those programs simply stay
 * unlabeled and the page still renders.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserHomeService {

    private static final ProgramLabel.LabelSource MODEL = ProgramLabel.LabelSource.MODEL_V2;

    private final ProgramRepository programRepository;
    private final ChannelRepository channelRepository;
    private final ProgramLabelRepository programLabelRepository;
    private final UserPreferenceRepository userPreferenceRepository;
    private final UserBookmarkRepository userBookmarkRepository;
    private final MlClient mlClient;

    @Transactional
    public HomeResponse getHome(Long userId, String dateYyyymmdd, String isoDate) {
        List<Program> programs = programRepository
                .findByDraftBatchIdIsNullAndBeginTimeStartingWithOrderByBeginTimeAscChannelIdAsc(dateYyyymmdd);

        Map<String, String> channelNames = lookupChannelNames(programs);

        // Lazily label any program that has no category yet.
        labelMissing(programs, channelNames);

        // Pull MODEL_V2 labels (for confidence/margin) for everything we show.
        List<Long> ids = programs.stream().map(Program::getId).toList();
        Map<Long, ProgramLabel> modelLabels = ids.isEmpty() ? Map.of()
                : programLabelRepository.findByProgramIdInAndLabelSource(ids, MODEL).stream()
                .collect(Collectors.toMap(ProgramLabel::getProgramId, l -> l, (a, b) -> a));

        // Caller's preferences + which of today's programs they've bookmarked.
        List<String> preferences = userPreferenceRepository.findByUserId(userId).stream()
                .map(p -> p.getCategory().name())
                .toList();
        Set<Long> bookmarked = ids.isEmpty() ? Set.of()
                : userBookmarkRepository.findByUserIdAndProgramIdIn(userId, ids).stream()
                .map(b -> b.getProgramId())
                .collect(Collectors.toSet());

        List<HomeProgramResponse> rows = programs.stream()
                .map(p -> toRow(p, channelNames, modelLabels.get(p.getId()), bookmarked.contains(p.getId())))
                .toList();

        Map<String, Long> counts = programs.stream()
                .filter(p -> p.getCategory() != null)
                .collect(Collectors.groupingBy(p -> p.getCategory().name(), Collectors.counting()));

        return HomeResponse.builder()
                .date(isoDate)
                .preferences(preferences)
                .categoryCounts(counts)
                .programs(rows)
                .build();
    }

    // --- lazy labeling --------------------------------------------------------

    private void labelMissing(List<Program> programs, Map<String, String> channelNames) {
        List<Program> missing = programs.stream()
                .filter(p -> p.getCategory() == null)
                .toList();
        if (missing.isEmpty()) return;

        List<MlClient.Item> items = missing.stream()
                .map(p -> new MlClient.Item(
                        p.getName(),
                        p.getContent(),
                        p.getChannelId() == null ? null : channelNames.get(p.getChannelId())))
                .toList();

        List<MlClient.Prediction> preds = mlClient.predict(items);
        if (preds.size() != missing.size()) {
            // Service down or response misaligned — skip; page still renders.
            log.debug("Skipping lazy labeling: got {} predictions for {} programs",
                    preds.size(), missing.size());
            return;
        }

        for (int i = 0; i < missing.size(); i++) {
            Program p = missing.get(i);
            MlClient.Prediction pr = preds.get(i);
            Program.Category cat = parseCategory(pr.label());
            if (cat == null) continue;
            p.setCategory(cat);
            programRepository.save(p);
            upsertModelLabel(p.getId(), cat, pr.confidence(), pr.margin());
        }
    }

    private void upsertModelLabel(Long programId, Program.Category cat, Double conf, Double margin) {
        ProgramLabel label = programLabelRepository
                .findByProgramIdAndLabelSource(programId, MODEL)
                .orElseGet(() -> ProgramLabel.builder()
                        .programId(programId)
                        .labelSource(MODEL)
                        .isVerified(false)
                        .build());
        label.setCategory(cat);
        label.setNote(formatNote(conf, margin));
        programLabelRepository.save(label);
    }

    // --- mapping helpers ------------------------------------------------------

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

    private static Program.Category parseCategory(String label) {
        if (label == null) return null;
        try {
            return Program.Category.valueOf(label);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String formatNote(Double conf, Double margin) {
        StringBuilder sb = new StringBuilder();
        if (conf != null) sb.append(String.format("conf=%.4f", conf));
        if (margin != null) {
            if (sb.length() > 0) sb.append(';');
            sb.append(String.format("margin=%.4f", margin));
        }
        return sb.length() == 0 ? null : sb.toString();
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