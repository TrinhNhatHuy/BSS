package com.bss.backend_bss.specification;

import com.bss.backend_bss.dto.program.ProgramFilter;
import com.bss.backend_bss.entity.Program;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

/**
 * Composable filter predicates for the program list endpoint.
 *
 * Mirrors the style of ChannelSpecifications: each method returns a
 * Specification<Program> that adds ONE filter, and null/blank inputs are
 * skipped so the caller can wire them all unconditionally.
 *
 * Date-range filtering exploits the fact that begin_time is stored as a
 * fixed-width YYYYMMDDHHMMSS string, which sorts chronologically as text —
 * so a lexical >= / <= comparison against a YYYYMMDD000000-style prefix
 * is equivalent to a real date comparison and lets us use the existing
 * (channel_id, begin_time) index.
 */
public final class ProgramSpecifications {

    private ProgramSpecifications() {}

    public static Specification<Program> build(ProgramFilter f) {
        return Specification.where(nameContains(f.getName()))
                .and(contentContains(f.getContent()))
                .and(channelEquals(f.getChannelId()))
                .and(categoryEquals(f.getCategory()))
                .and(beginTimeFrom(f.getDateFrom()))
                .and(beginTimeTo(f.getDateTo()))
                .and(statusEquals(f.getStatus()));
    }

    public static Specification<Program> nameContains(String name) {
        if (!StringUtils.hasText(name)) return null;
        String pattern = "%" + name.toLowerCase() + "%";
        return (root, query, cb) -> cb.like(cb.lower(root.get("name")), pattern);
    }

    public static Specification<Program> contentContains(String content) {
        if (!StringUtils.hasText(content)) return null;
        String pattern = "%" + content.toLowerCase() + "%";
        return (root, query, cb) -> cb.like(cb.lower(root.get("content")), pattern);
    }

    public static Specification<Program> channelEquals(String channelId) {
        if (!StringUtils.hasText(channelId)) return null;
        return (root, query, cb) -> cb.equal(root.get("channelId"), channelId);
    }

    public static Specification<Program> categoryEquals(Program.Category category) {
        if (category == null) return null;
        return (root, query, cb) -> cb.equal(root.get("category"), category);
    }

    /** Inclusive lower bound: begin_time >= dateFrom 00:00:00. */
    public static Specification<Program> beginTimeFrom(String isoDate) {
        if (!StringUtils.hasText(isoDate)) return null;
        String prefix = isoDate.replace("-", "") + "000000";
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("beginTime"), prefix);
    }

    /** Inclusive upper bound: begin_time <= dateTo 23:59:59. */
    public static Specification<Program> beginTimeTo(String isoDate) {
        if (!StringUtils.hasText(isoDate)) return null;
        String prefix = isoDate.replace("-", "") + "235959";
        return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("beginTime"), prefix);
    }

    /**
     * "live"  → draft_batch_id IS NULL (published schedule)
     * "draft" → draft_batch_id IS NOT NULL (pending AI/editor review)
     */
    public static Specification<Program> statusEquals(String status) {
        if (!StringUtils.hasText(status)) return null;
        String s = status.trim().toLowerCase();
        if ("live".equals(s)) {
            return (root, query, cb) -> cb.isNull(root.get("draftBatchId"));
        }
        if ("draft".equals(s)) {
            return (root, query, cb) -> cb.isNotNull(root.get("draftBatchId"));
        }
        return null;
    }
}