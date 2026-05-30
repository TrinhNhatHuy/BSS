package com.bss.backend_bss.specification;

import com.bss.backend_bss.dto.reschedulelog.RescheduleLogFilter;
import com.bss.backend_bss.entity.RescheduleLog;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Composable filter predicates for the reschedule-log list endpoint.
 *
 * Mirrors ProgramSpecifications: each method returns a Specification that adds
 * ONE filter, and null/blank inputs are skipped so callers can wire them all
 * unconditionally.
 *
 * Unlike program begin_time (a YYYYMMDDHHMMSS string), reschedule logs are
 * filtered by create_time, a real TIMESTAMP — so the date range is expressed as
 * a LocalDateTime between start-of-day and end-of-day.
 */
public final class RescheduleLogSpecifications {

    private RescheduleLogSpecifications() {}

    public static Specification<RescheduleLog> build(RescheduleLogFilter f) {
        return Specification.where(nameContains(f.getQ()))
                .and(channelEquals(f.getChannelId()))
                .and(statusEquals(f.getStatus()))
                .and(createTimeFrom(f.getDateFrom()))
                .and(createTimeTo(f.getDateTo()));
    }

    /** Matches the search term against either the new name or the original name. */
    public static Specification<RescheduleLog> nameContains(String q) {
        if (!StringUtils.hasText(q)) return null;
        String pattern = "%" + q.toLowerCase() + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("name")), pattern),
                cb.like(cb.lower(root.get("originalName")), pattern)
        );
    }

    public static Specification<RescheduleLog> channelEquals(String channelId) {
        if (!StringUtils.hasText(channelId)) return null;
        return (root, query, cb) -> cb.equal(root.get("channelId"), channelId);
    }

    public static Specification<RescheduleLog> statusEquals(RescheduleLog.Status status) {
        if (status == null) return null;
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    /** Inclusive lower bound: create_time >= dateFrom 00:00:00. */
    public static Specification<RescheduleLog> createTimeFrom(String isoDate) {
        if (!StringUtils.hasText(isoDate)) return null;
        LocalDateTime start = LocalDate.parse(isoDate).atStartOfDay();
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createTime"), start);
    }

    /** Inclusive upper bound: create_time <= dateTo 23:59:59.999999. */
    public static Specification<RescheduleLog> createTimeTo(String isoDate) {
        if (!StringUtils.hasText(isoDate)) return null;
        LocalDateTime end = LocalDate.parse(isoDate).atTime(23, 59, 59, 999_999_000);
        return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("createTime"), end);
    }
}