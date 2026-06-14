package com.bss.backend_bss.service;

import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.entity.ProgramLabel;
import com.bss.backend_bss.repository.ChannelRepository;
import com.bss.backend_bss.repository.ProgramLabelRepository;
import com.bss.backend_bss.repository.ProgramRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Labels live programs with the category model and persists the result.
 *
 * Shared by the USER home page (on a bounded candidate pool), the per-channel
 * schedule, and the background {@link LabelWarmupScheduler}. The model prediction
 * itself is one fast batch call ({@link MlClient}); the expensive part is writing
 * back to the remote cloud DB, so categories + MODEL_V2 labels are flushed with
 * {@code saveAll} under Hibernate JDBC batching (see application-*.properties)
 * rather than one round-trip per row.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProgramLabelingService {

    private static final ProgramLabel.LabelSource MODEL = ProgramLabel.LabelSource.MODEL_V2;

    private final ProgramRepository programRepository;
    private final ChannelRepository channelRepository;
    private final ProgramLabelRepository programLabelRepository;
    private final MlClient mlClient;

    /**
     * Label every program in {@code programs} that has no category yet, persisting
     * {@code program.category} and a MODEL_V2 {@code program_label} row. Returns the
     * number newly labeled (0 if none were missing or the ML service was
     * unreachable — callers treat that as "couldn't label now" and carry on).
     */
    @Transactional
    public int labelAndPersist(List<Program> programs) {
        List<Program> missing = programs.stream()
                .filter(p -> p.getCategory() == null)
                .toList();
        if (missing.isEmpty()) return 0;

        Map<String, String> channelNames = lookupChannelNames(missing);
        List<MlClient.Item> items = missing.stream()
                .map(p -> new MlClient.Item(
                        p.getName(),
                        p.getContent(),
                        p.getChannelId() == null ? null : channelNames.get(p.getChannelId())))
                .toList();

        List<MlClient.Prediction> preds = mlClient.predict(items);
        if (preds.size() != missing.size()) {
            log.debug("Skipping labeling: got {} predictions for {} programs", preds.size(), missing.size());
            return 0;
        }

        // One query for any pre-existing MODEL_V2 labels, then upsert in bulk.
        List<Long> ids = missing.stream().map(Program::getId).toList();
        Map<Long, ProgramLabel> existing = programLabelRepository
                .findByProgramIdInAndLabelSource(ids, MODEL).stream()
                .collect(Collectors.toMap(ProgramLabel::getProgramId, l -> l, (a, b) -> a));

        List<Program> programUpdates = new ArrayList<>(missing.size());
        List<ProgramLabel> labelUpserts = new ArrayList<>(missing.size());
        for (int i = 0; i < missing.size(); i++) {
            Program p = missing.get(i);
            Program.Category cat = parseCategory(preds.get(i).label());
            if (cat == null) continue;
            p.setCategory(cat);
            programUpdates.add(p);

            ProgramLabel label = existing.getOrDefault(p.getId(), ProgramLabel.builder()
                    .programId(p.getId())
                    .labelSource(MODEL)
                    .isVerified(false)
                    .build());
            label.setCategory(cat);
            label.setNote(formatNote(preds.get(i).confidence(), preds.get(i).margin()));
            labelUpserts.add(label);
        }

        programRepository.saveAll(programUpdates);
        programLabelRepository.saveAll(labelUpserts);
        return programUpdates.size();
    }

    // --- helpers --------------------------------------------------------------

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
}