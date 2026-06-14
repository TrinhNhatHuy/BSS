package com.bss.backend_bss.dto.draft;

import com.bss.backend_bss.dto.program.ProgramResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * One AI draft batch plus its cleaned programs — backs the draft review modal,
 * where the editor inspects, edits, and then approves or deletes the draft.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DraftBatchDetailResponse {
    private Long id;
    private String channelId;
    private String channelName;
    private String status;
    private String programDate;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    /** The cleaned programs in this batch, in air order. */
    private List<ProgramResponse> programs;
}