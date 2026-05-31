package com.bss.backend_bss.dto.program;

import com.bss.backend_bss.entity.Program;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body of PUT /api/editor/programs/{id} — edits the program detail page fields.
 *
 * channel_id and draft_batch_id are NOT editable here: a program's channel and
 * its live/draft status are structural and changed through other flows. Times
 * are the same fixed-width YYYYMMDDHHMMSS strings used everywhere else.
 */
@Data
public class UpdateProgramRequest {

    @Size(max = 500, message = "Name must be at most 500 characters")
    private String name;

    @Size(max = 500, message = "Content must be at most 500 characters")
    private String content;

    /** Nullable — null clears the category. */
    private Program.Category category;

    @NotBlank(message = "Begin time is required")
    @Pattern(regexp = "\\d{14}", message = "Begin time must be 14 digits (YYYYMMDDHHMMSS)")
    private String beginTime;

    @NotBlank(message = "End time is required")
    @Pattern(regexp = "\\d{14}", message = "End time must be 14 digits (YYYYMMDDHHMMSS)")
    private String endTime;
}
