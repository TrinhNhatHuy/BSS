package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.Program;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProgramRepository
        extends JpaRepository<Program, Long>, JpaSpecificationExecutor<Program> {

    /**
     * Live (non-draft) programs for a channel whose begin_time starts with the
     * given YYYYMMDD prefix — i.e., programs that air on that date.
     *
     * Uses the idx_program_live partial index on (channel_id, begin_time).
     */
    List<Program> findByChannelIdAndDraftBatchIdIsNullAndBeginTimeStartingWithOrderByBeginTimeAsc(
            String channelId, String dateYyyymmdd);

    /**
     * Live (non-draft) programs across ALL channels whose begin_time starts with
     * the given YYYYMMDD prefix — the whole day's published schedule. Backs the
     * USER home page (UserHomeService).
     */
    List<Program> findByDraftBatchIdIsNullAndBeginTimeStartingWithOrderByBeginTimeAscChannelIdAsc(
            String dateYyyymmdd);

    /**
     * All programs belonging to one AI draft batch, in air order — backs the
     * draft review panel and the approve/replace flow.
     */
    List<Program> findByDraftBatchIdOrderByBeginTimeAsc(Long draftBatchId);

    /** How many programs a draft batch holds (for the batch summary list). */
    long countByDraftBatchId(Long draftBatchId);

    /**
     * Live (non-draft) programs whose begin_time is in [from, to] (inclusive
     * YYYYMMDDHHMMSS), soonest first, capped via {@code pageable}. Backs the USER
     * home "candidate pool" — only the next slice of upcoming programs is loaded
     * and labeled, instead of the whole day across every channel.
     */
    List<Program> findByDraftBatchIdIsNullAndBeginTimeBetweenOrderByBeginTimeAsc(
            String from, String to, Pageable pageable);

    /**
     * Like the above but only the still-unlabeled ones (category IS NULL). Backs
     * the background label warm-up so the home request finds labels already cached.
     */
    List<Program> findByDraftBatchIdIsNullAndCategoryIsNullAndBeginTimeBetweenOrderByBeginTimeAsc(
            String from, String to, Pageable pageable);

    /**
     * Live (non-draft) program counts grouped by channel for programs whose
     * begin_time falls within [from, to] (inclusive YYYYMMDDHHMMSS prefixes).
     *
     * Returns one row per channel that has ≥1 program in the window:
     *   row[0] = channelId (String), row[1] = count (Long)
     * Channels with zero programs are absent — the dashboard service fills them
     * in as 0 by merging against the full channel list. Backs the per-channel
     * bar chart and Channels Status list on the Editor Dashboard.
     *
     * Uses the idx_program_live partial index on (channel_id, begin_time).
     */
    @Query("SELECT p.channelId, COUNT(p) FROM Program p " +
           "WHERE p.draftBatchId IS NULL AND p.channelId IS NOT NULL " +
           "AND p.beginTime >= :from AND p.beginTime <= :to " +
           "GROUP BY p.channelId")
    List<Object[]> countLiveByChannelInRange(@Param("from") String from, @Param("to") String to);
}