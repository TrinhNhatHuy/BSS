package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.export.ExportRequest;
import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.ChannelExportId;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.entity.RescheduleLog;
import com.bss.backend_bss.repository.ChannelExportIdRepository;
import com.bss.backend_bss.repository.ChannelRepository;
import com.bss.backend_bss.repository.ProgramRepository;
import com.bss.backend_bss.repository.RescheduleLogRepository;
import com.bss.backend_bss.specification.ProgramSpecifications;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.streaming.SXSSFSheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Builds the .xlsx workbook for the editor "Tools &gt; Export XLSX" page.
 *
 * What gets written is driven by an {@link ExportRequest}:
 *   • a "Schedule" sheet with the live (and optionally draft) program rows for
 *     the selected channels in the selected date range, and
 *   • an optional "Reschedule Logs" sheet with the change history.
 *
 * Channel names are bulk-resolved in one query (not per row), the same pattern
 * {@link ProgramService} / {@link RescheduleLogService} use.
 *
 * begin_time / end_time are stored as 14-char YYYYMMDDHHMMSS strings; we split
 * them into readable Date / Start / End columns here rather than dumping the raw
 * code, so the spreadsheet is usable as-is.
 */
@Service
@RequiredArgsConstructor
public class ExportXlsxService {

    private final ProgramRepository programRepository;
    private final RescheduleLogRepository rescheduleLogRepository;
    private final ChannelRepository channelRepository;
    private final ChannelExportIdRepository channelExportIdRepository;

    /** Generate the workbook as a byte array ready to stream to the browser. */
    @Transactional(readOnly = true)
    public byte[] generate(ExportRequest req) {
        List<String> channelIds = resolveChannelIds(req.getChannelIds());

        try (SXSSFWorkbook workbook = new SXSSFWorkbook(SXSSFWorkbook.DEFAULT_WINDOW_SIZE)) {
            CellStyle headerStyle = headerStyle(workbook);

            if (req.wantsPrograms() || req.wantsDrafts()) {
                writeScheduleSheet(workbook, headerStyle, channelIds, req);
            }
            if (req.wantsLogs()) {
                writeLogsSheet(workbook, headerStyle, channelIds, req);
            }
            // POI refuses to save a workbook with zero sheets — always leave one.
            if (workbook.getNumberOfSheets() == 0) {
                Sheet empty = workbook.createSheet("Schedule");
                writeRow(empty, 0, headerStyle, "No data");
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            workbook.dispose();
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to generate XLSX export", e);
        }
    }

    /**
     * Suggested download file name, e.g. BSS_Schedule_VTV1_20260501_20260530.xlsx.
     * The frontend can override, but having the server name it keeps exports
     * consistent across editors.
     */
    public String buildFileName(ExportRequest req) {
        List<String> ids = req.getChannelIds();
        String scope;
        if (ids == null || ids.isEmpty()) {
            scope = "AllChannels";
        } else if (ids.size() == 1) {
            scope = sanitize(ids.get(0));
        } else {
            scope = ids.size() + "channels";
        }

        String from = compact(req.getDateFrom());
        String to = compact(req.getDateTo());
        String range = (from == null && to == null)
                ? "all"
                : (from == null ? "start" : from) + "_" + (to == null ? "end" : to);

        return "BSS_Schedule_" + scope + "_" + range + ".xlsx";
    }

    // ────────────────────────────── Schedule sheet ──────────────────────────────

    private void writeScheduleSheet(SXSSFWorkbook wb, CellStyle headerStyle,
                                    List<String> channelIds, ExportRequest req) {
        Specification<Program> spec = Specification
                .where(programChannelIn(channelIds))
                .and(ProgramSpecifications.beginTimeFrom(req.getDateFrom()))
                .and(ProgramSpecifications.beginTimeTo(req.getDateTo()))
                .and(draftFilter(req));

        List<Program> programs = programRepository.findAll(
                spec, Sort.by("channelId").ascending().and(Sort.by("beginTime").ascending()));

        Set<String> chIds = programs.stream()
                .map(Program::getChannelId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<String, String> names = channelNames(chIds);
        Map<String, String> exportIds = channelExportIds(chIds);

        SXSSFSheet sheet = wb.createSheet("Schedule");
        sheet.createFreezePane(0, 1); // keep the header visible while scrolling

        String[] headers = {
                "Channel ID", "Channel", "Export IDs", "Date", "Start", "End",
                "Program", "Content", "Category", "Type"
        };
        writeRow(sheet, 0, headerStyle, headers);

        int r = 1;
        for (Program p : programs) {
            writeRow(sheet, r++, null,
                    p.getChannelId(),
                    p.getChannelId() == null ? "" : names.getOrDefault(p.getChannelId(), ""),
                    p.getChannelId() == null ? "" : exportIds.getOrDefault(p.getChannelId(), ""),
                    fmtDate(p.getBeginTime()),
                    fmtTime(p.getBeginTime()),
                    fmtTime(p.getEndTime()),
                    p.getName(),
                    p.getContent(),
                    p.getCategory() == null ? "" : p.getCategory().name(),
                    p.getDraftBatchId() == null ? "Published" : "Draft");
        }
        setWidths(sheet, headers.length, new int[]{14, 22, 20, 12, 8, 8, 40, 40, 12, 11});
    }

    /**
     * draft_batch_id filter from the include flags:
     *   programs only            → IS NULL
     *   drafts only              → IS NOT NULL
     *   both                     → no filter
     */
    private Specification<Program> draftFilter(ExportRequest req) {
        boolean live = req.wantsPrograms();
        boolean draft = req.wantsDrafts();
        if (live && !draft) return (root, q, cb) -> cb.isNull(root.get("draftBatchId"));
        if (!live && draft) return (root, q, cb) -> cb.isNotNull(root.get("draftBatchId"));
        return null; // both → everything
    }

    private Specification<Program> programChannelIn(List<String> ids) {
        if (ids == null || ids.isEmpty()) return null;
        return (root, q, cb) -> root.get("channelId").in(ids);
    }

    // ──────────────────────────── Reschedule logs sheet ─────────────────────────

    private void writeLogsSheet(SXSSFWorkbook wb, CellStyle headerStyle,
                                List<String> channelIds, ExportRequest req) {
        Specification<RescheduleLog> spec = Specification
                .where(logChannelIn(channelIds))
                .and(logCreatedFrom(req.getDateFrom()))
                .and(logCreatedTo(req.getDateTo()));

        // Newest first: id is a monotonic BIGSERIAL, reliable even for bulk-ingested
        // rows whose create_time was never populated.
        List<RescheduleLog> logs = rescheduleLogRepository.findAll(spec, Sort.by("id").descending());

        Map<String, String> names = channelNames(
                logs.stream().map(RescheduleLog::getChannelId).filter(Objects::nonNull).collect(Collectors.toSet()));

        SXSSFSheet sheet = wb.createSheet("Reschedule Logs");
        sheet.createFreezePane(0, 1);

        String[] headers = {
                "Channel ID", "Channel", "Action",
                "New Date", "New Start", "New End", "New Program", "New Content",
                "Old Date", "Old Start", "Old End", "Old Program", "Old Content",
                "Logged At"
        };
        writeRow(sheet, 0, headerStyle, headers);

        int r = 1;
        for (RescheduleLog log : logs) {
            writeRow(sheet, r++, null,
                    log.getChannelId(),
                    log.getChannelId() == null ? "" : names.getOrDefault(log.getChannelId(), ""),
                    log.getStatus() == null ? "" : log.getStatus().name(),
                    fmtDate(log.getBeginTime()),
                    fmtTime(log.getBeginTime()),
                    fmtTime(log.getEndTime()),
                    log.getName(),
                    log.getContent(),
                    fmtDate(log.getOriginalBeginTime()),
                    fmtTime(log.getOriginalBeginTime()),
                    fmtTime(log.getOriginalEndTime()),
                    log.getOriginalName(),
                    log.getOriginalContent(),
                    log.getCreateTime() == null ? "" : log.getCreateTime().toString());
        }
        setWidths(sheet, headers.length,
                new int[]{14, 22, 10, 12, 8, 8, 34, 34, 12, 8, 8, 34, 34, 20});
    }

    private Specification<RescheduleLog> logChannelIn(List<String> ids) {
        if (ids == null || ids.isEmpty()) return null;
        return (root, q, cb) -> root.get("channelId").in(ids);
    }

    /**
     * Lower bound on create_time. Rows with a null create_time (bulk-ingested)
     * are kept so the activity history is never silently dropped.
     */
    private Specification<RescheduleLog> logCreatedFrom(String isoDate) {
        if (!StringUtils.hasText(isoDate)) return null;
        var from = java.time.LocalDate.parse(isoDate).atStartOfDay();
        return (root, q, cb) -> cb.or(
                cb.isNull(root.get("createTime")),
                cb.greaterThanOrEqualTo(root.get("createTime"), from));
    }

    private Specification<RescheduleLog> logCreatedTo(String isoDate) {
        if (!StringUtils.hasText(isoDate)) return null;
        var to = java.time.LocalDate.parse(isoDate).atTime(23, 59, 59);
        return (root, q, cb) -> cb.or(
                cb.isNull(root.get("createTime")),
                cb.lessThanOrEqualTo(root.get("createTime"), to));
    }

    // ────────────────────────────────── helpers ─────────────────────────────────

    /** Empty selection means "all channels". */
    private List<String> resolveChannelIds(List<String> requested) {
        if (requested != null && !requested.isEmpty()) return requested;
        return channelRepository.findAll().stream().map(Channel::getId).toList();
    }

    private Map<String, String> channelNames(Set<String> ids) {
        if (ids.isEmpty()) return Map.of();
        return channelRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Channel::getId, Channel::getName));
    }

    /**
     * Per-channel export IDs formatted as "HD:123 | SD:456" (sorted by type).
     * Bulk-loaded in one query and grouped by channel id, so the schedule sheet
     * can carry each channel's external broadcast IDs without an N+1.
     */
    private Map<String, String> channelExportIds(Set<String> ids) {
        if (ids.isEmpty()) return Map.of();
        return channelExportIdRepository.findByChannelIds(ids).stream()
                .collect(Collectors.groupingBy(
                        e -> e.getChannel().getId(),
                        Collectors.collectingAndThen(
                                Collectors.toList(),
                                list -> list.stream()
                                        .sorted(Comparator.comparing(ChannelExportId::getType))
                                        .map(e -> e.getType() + ":" + e.getExternalId())
                                        .collect(Collectors.joining(" | "))
                        )
                ));
    }

    private CellStyle headerStyle(Workbook wb) {
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());

        CellStyle style = wb.createCellStyle();
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_50_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.LEFT);
        return style;
    }

    private void writeRow(Sheet sheet, int rowIdx, CellStyle style, String... values) {
        Row row = sheet.createRow(rowIdx);
        for (int c = 0; c < values.length; c++) {
            Cell cell = row.createCell(c);
            cell.setCellValue(values[c] == null ? "" : values[c]);
            if (style != null) cell.setCellStyle(style);
        }
    }

    /** Column widths in characters (POI uses 1/256th-of-a-char units). */
    private void setWidths(Sheet sheet, int count, int[] charWidths) {
        for (int c = 0; c < count; c++) {
            int chars = c < charWidths.length ? charWidths[c] : 15;
            sheet.setColumnWidth(c, chars * 256);
        }
    }

    private static String fmtDate(String ts) {
        if (ts == null || ts.length() < 8) return "";
        return ts.substring(0, 4) + "-" + ts.substring(4, 6) + "-" + ts.substring(6, 8);
    }

    private static String fmtTime(String ts) {
        if (ts == null || ts.length() < 12) return "";
        return ts.substring(8, 10) + ":" + ts.substring(10, 12);
    }

    private static String compact(String isoDate) {
        return StringUtils.hasText(isoDate) ? isoDate.replace("-", "") : null;
    }

    private static String sanitize(String s) {
        return s == null ? "" : s.replaceAll("[^A-Za-z0-9_-]", "_");
    }
}