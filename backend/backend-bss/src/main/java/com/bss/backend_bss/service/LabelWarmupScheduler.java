package com.bss.backend_bss.service;

import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.repository.ProgramRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Pre-labels upcoming programs in the background so the USER home request finds
 * categories already cached and returns in a fraction of a second.
 *
 * Runs shortly after boot and then every 30 minutes ({@code fixedDelay}, so a slow
 * run never overlaps the next). Each pass labels the still-unlabeled programs from
 * now to the end of tomorrow, capped, and delegates to {@link ProgramLabelingService}
 * (which batches the cloud-DB writes). All failures are swallowed — the ML service
 * being down must never crash the scheduler.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LabelWarmupScheduler {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final int MAX_PER_RUN = 1_500;

    private final ProgramRepository programRepository;
    private final ProgramLabelingService labelingService;
    private final ZoneId reminderZone;

    @Scheduled(initialDelay = 60_000, fixedDelay = 1_800_000)
    public void warmUp() {
        try {
            LocalDateTime now = LocalDateTime.now(reminderZone);
            String from = now.format(TS);
            String to = now.toLocalDate().plusDays(1).atTime(23, 59, 59).format(TS);

            List<Program> pending = programRepository
                    .findByDraftBatchIdIsNullAndCategoryIsNullAndBeginTimeBetweenOrderByBeginTimeAsc(
                            from, to, PageRequest.of(0, MAX_PER_RUN));
            if (pending.isEmpty()) return;

            int labeled = labelingService.labelAndPersist(pending);
            log.info("Label warm-up: labeled {} of {} upcoming programs.", labeled, pending.size());
        } catch (Exception e) {
            log.warn("Label warm-up skipped: {}", e.getMessage());
        }
    }
}
