package com.bss.backend_bss.dto.admin;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** Enable (true) or disable/"stop" (false) an account on the ADMIN Accounts page. */
@Data
public class UpdateStatusRequest {

    @NotNull(message = "Status is required")
    private Boolean status;
}