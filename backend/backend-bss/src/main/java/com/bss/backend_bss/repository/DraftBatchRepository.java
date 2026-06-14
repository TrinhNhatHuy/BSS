package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.DraftBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DraftBatchRepository extends JpaRepository<DraftBatch, Long> {

    /**
     * All draft batches for a channel that aren't APPROVED yet (PROCESSING +
     * COMPLETED), newest first — the "pending review" list shown on ViewChannel.
     * Approved batches are excluded: their programs have already been promoted to
     * live (draft_batch_id = NULL), so the batch row is just an audit record.
     */
    List<DraftBatch> findByChannelIdAndStatusNotOrderByCreateTimeDesc(
            String channelId, DraftBatch.Status status);

    /**
     * Same as above but across ALL channels — backs the standalone "Drafts by AI"
     * page that shows pending batches for every channel at once.
     */
    List<DraftBatch> findByStatusNotOrderByCreateTimeDesc(DraftBatch.Status status);
}
