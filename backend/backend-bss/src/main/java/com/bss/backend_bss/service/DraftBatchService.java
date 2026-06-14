package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.draft.DraftBatchDetailResponse;
import com.bss.backend_bss.dto.draft.DraftBatchResponse;
import com.bss.backend_bss.dto.program.ProgramResponse;
import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.DraftBatch;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.exception.InvalidReferenceException;
import com.bss.backend_bss.exception.ResourceNotFoundException;
import com.bss.backend_bss.repository.ChannelRepository;
import com.bss.backend_bss.repository.DraftBatchRepository;
import com.bss.backend_bss.repository.ProgramRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Editor-facing operations over AI draft batches produced by the n8n "AI
 * Controller" workflow. The workflow itself creates the batch + its cleaned
 * programs; this service handles everything the editor does afterwards:
 * listing pending drafts, reviewing one, deleting it, or approving it.
 *
 * Approve semantics = REPLACE: the cleaned draft takes over the live schedule
 * for the day(s) it covers — the existing live programs for those day(s) on the
 * same channel are deleted, then the draft's programs are promoted to live
 * (draft_batch_id → NULL). Deleting a draft cascade-removes its programs via the
 * fk_program_draft_batch ON DELETE CASCADE constraint.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DraftBatchService {

    private final DraftBatchRepository draftBatchRepository;
    private final ProgramRepository programRepository;
    private final ChannelRepository channelRepository;

    /** Pending (not-yet-approved) draft batches for a channel, newest first. */
    @Transactional(readOnly = true)
    public List<DraftBatchResponse> listForChannel(String channelId) {
        return toSummaries(draftBatchRepository
                .findByChannelIdAndStatusNotOrderByCreateTimeDesc(channelId, DraftBatch.Status.APPROVED));
    }

    /**
     * All pending (not-yet-approved) draft batches across every channel, newest
     * first — backs the standalone "Drafts by AI" page.
     */
    @Transactional(readOnly = true)
    public List<DraftBatchResponse> listAll() {
        return toSummaries(draftBatchRepository
                .findByStatusNotOrderByCreateTimeDesc(DraftBatch.Status.APPROVED));
    }

    /**
     * Map batches to summaries, resolving channel names in one bulk query. Hides
     * empty batches — a healthy run always has programs; 0-program rows are
     * leftovers from a failed/partial n8n run and aren't reviewable.
     */
    private List<DraftBatchResponse> toSummaries(List<DraftBatch> batches) {
        Map<String, String> channelNames = lookupChannelNames(batches);
        return batches.stream()
                .map(b -> DraftBatchResponse.builder()
                        .id(b.getId())
                        .channelId(b.getChannelId())
                        .channelName(b.getChannelId() == null ? null : channelNames.get(b.getChannelId()))
                        .status(b.getStatus() == null ? null : b.getStatus().name())
                        .programDate(b.getProgramDate())
                        .programCount(programRepository.countByDraftBatchId(b.getId()))
                        .createTime(b.getCreateTime())
                        .updateTime(b.getUpdateTime())
                        .build())
                .filter(r -> r.getProgramCount() > 0)
                .toList();
    }

    private Map<String, String> lookupChannelNames(List<DraftBatch> batches) {
        Set<String> ids = batches.stream()
                .map(DraftBatch::getChannelId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return channelRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Channel::getId, Channel::getName));
    }

    /** One draft batch with its cleaned programs — backs the review modal. */
    @Transactional(readOnly = true)
    public DraftBatchDetailResponse getDetail(Long id) {
        DraftBatch batch = draftBatchRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Draft batch not found: " + id));

        List<Program> programs = programRepository.findByDraftBatchIdOrderByBeginTimeAsc(id);
        String channelName = channelRepository.findById(batch.getChannelId())
                .map(Channel::getName).orElse(null);

        return DraftBatchDetailResponse.builder()
                .id(batch.getId())
                .channelId(batch.getChannelId())
                .channelName(channelName)
                .status(batch.getStatus() == null ? null : batch.getStatus().name())
                .programDate(batch.getProgramDate())
                .createTime(batch.getCreateTime())
                .updateTime(batch.getUpdateTime())
                .programs(programs.stream().map(p -> toResponse(p, channelName)).toList())
                .build();
    }

    /**
     * Delete a whole draft batch. Its programs are removed automatically by the
     * fk_program_draft_batch ON DELETE CASCADE constraint (and any labels/
     * bookmarks/reminders on those brand-new draft rows cascade in turn).
     */
    @Transactional
    public void delete(Long id) {
        DraftBatch batch = draftBatchRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Draft batch not found: " + id));
        draftBatchRepository.delete(batch);
    }

    /**
     * Approve a draft = replace the live schedule for the day(s) it covers with
     * the cleaned programs.
     *
     *   1. work out the day prefix(es) (YYYYMMDD) from the draft's programs
     *   2. delete the existing live programs on this channel for those day(s)
     *   3. promote the draft's programs to live (draft_batch_id → NULL)
     *   4. mark the batch APPROVED (approved_by / approved_time)
     */
    @Transactional
    public void approve(Long id, Long approverId) {
        DraftBatch batch = draftBatchRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Draft batch not found: " + id));

        if (batch.getStatus() == DraftBatch.Status.APPROVED) {
            throw new InvalidReferenceException("This draft has already been approved.");
        }

        List<Program> draftPrograms = programRepository.findByDraftBatchIdOrderByBeginTimeAsc(id);
        if (draftPrograms.isEmpty()) {
            throw new InvalidReferenceException("This draft has no programs to approve.");
        }

        // The day(s) this draft covers, taken from the cleaned programs themselves
        // so we never depend on how draft_batch.program_date was formatted.
        Set<String> dayPrefixes = draftPrograms.stream()
                .map(Program::getBeginTime)
                .filter(bt -> bt != null && bt.length() >= 8)
                .map(bt -> bt.substring(0, 8))
                .collect(Collectors.toSet());

        // Replace: drop the existing live schedule for those day(s) on this channel.
        int removed = 0;
        for (String day : dayPrefixes) {
            List<Program> live = programRepository
                    .findByChannelIdAndDraftBatchIdIsNullAndBeginTimeStartingWithOrderByBeginTimeAsc(
                            batch.getChannelId(), day);
            if (!live.isEmpty()) {
                programRepository.deleteAll(live);
                removed += live.size();
            }
        }
        programRepository.flush(); // delete the old rows before promoting the new ones

        // Promote the cleaned draft programs to live.
        draftPrograms.forEach(p -> p.setDraftBatchId(null));
        programRepository.saveAll(draftPrograms);

        batch.setStatus(DraftBatch.Status.APPROVED);
        batch.setApprovedBy(approverId);
        batch.setApprovedTime(LocalDateTime.now());
        draftBatchRepository.save(batch);

        log.info("Approved draft batch {} for channel {} — replaced {} live program(s) with {} cleaned program(s) across day(s) {}",
                id, batch.getChannelId(), removed, draftPrograms.size(), dayPrefixes);
    }

    private ProgramResponse toResponse(Program p, String channelName) {
        return ProgramResponse.builder()
                .id(p.getId())
                .channelId(p.getChannelId())
                .channelName(p.getChannelId() == null ? null : channelName)
                .beginTime(p.getBeginTime())
                .endTime(p.getEndTime())
                .name(p.getName())
                .content(p.getContent())
                .category(p.getCategory())
                .draftBatchId(p.getDraftBatchId())
                .build();
    }
}