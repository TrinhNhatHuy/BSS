package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.export.ExportRequest;
import com.bss.backend_bss.service.ExportXlsxService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;

/**
 * Editor-only export endpoints (Tools &gt; Export XLSX).
 *
 *   GET /api/editor/export/xlsx → streams an .xlsx of the selected channels'
 *                                 schedule (and optionally reschedule logs)
 *
 * Path /api/editor/** is locked to the EDITOR role by SecurityConfig. The
 * controller is thin: it binds the query params, asks the service to build the
 * workbook, and sets the download headers.
 */
@RestController
@RequestMapping("/api/editor/export")
@RequiredArgsConstructor
public class ExportController {

    private static final MediaType XLSX = MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final ExportXlsxService exportXlsxService;

    /**
     * @ModelAttribute binds query params (channelIds repeated, dateFrom, dateTo,
     * includePrograms, includeDrafts, includeLogs) onto ExportRequest.
     *
     * Returns the file as an attachment so the browser saves it directly. The
     * Content-Disposition header carries the server-suggested file name; the
     * filename* form is added so non-ASCII names survive.
     */
    @GetMapping("/xlsx")
    public ResponseEntity<byte[]> exportXlsx(@ModelAttribute ExportRequest request) {
        byte[] body = exportXlsxService.generate(request);
        String fileName = exportXlsxService.buildFileName(request);

        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(fileName, StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(XLSX)
                .contentLength(body.length)
                .body(body);
    }
}