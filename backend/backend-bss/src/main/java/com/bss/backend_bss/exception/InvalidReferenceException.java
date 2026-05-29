package com.bss.backend_bss.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Thrown when a request references a foreign key value that doesn't exist
 * (e.g. channelGroupId=999 when group 999 isn't in the DB).
 * Maps to 422 Unprocessable Entity — semantically distinct from 400 (bad syntax).
 */
@ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
public class InvalidReferenceException extends RuntimeException {
    public InvalidReferenceException(String message) {
        super(message);
    }
}