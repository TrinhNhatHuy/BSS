package com.bss.backend_bss.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One program row on the USER home page (Today's Schedule).
 *
 * {@code category} is the model-assigned label; {@code confidence}/{@code margin}
 * come from the MODEL_V2 program_label note (null if labeled by another source or
 * not yet labeled). {@code bookmarked} reflects the current user's bookmarks.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HomeProgramResponse {
    private Long id;
    private String channelId;
    private String channelName;
    private String beginTime;   // YYYYMMDDHHMMSS
    private String endTime;     // YYYYMMDDHHMMSS
    private String name;
    private String content;
    private String category;    // one of the 7 enum names, or null
    private Double confidence;  // model softmax proxy, 0..1 (nullable)
    private Double margin;      // model decision margin (nullable)
    private boolean bookmarked;
}