package com.bss.backend_bss.dto.program;

import com.bss.backend_bss.entity.Program;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProgramResponse {
    private Long id;
    private String channelId;
    /** Resolved channel.name — null if the channel row no longer exists. */
    private String channelName;
    private String beginTime;
    private String endTime;
    private String name;
    private String content;
    private Program.Category category;
    /** Null means this row belongs to the live/published schedule. */
    private Long draftBatchId;
}