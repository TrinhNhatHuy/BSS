package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.Program;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
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
}