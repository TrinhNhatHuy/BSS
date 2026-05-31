package com.bss.backend_bss.specification;

import com.bss.backend_bss.dto.channel.ChannelFilter;
import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.ChannelExportId;
import com.bss.backend_bss.entity.Source;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

/**
 * Composable filter predicates for the channel list endpoint.
 *
 * Each public method returns a Specification<Channel> that adds ONE filter.
 * The build() method combines them. Null/blank inputs are skipped — so the
 * caller can wire all params unconditionally without if/else clutter.
 */
public final class ChannelSpecifications {

    private ChannelSpecifications() {}

    /**
     * Magic value sent by the frontend to mean "channels with no group".
     * Passing literal null in a query string is awkward, so we use -1 as the
     * sentinel. Document this in the API spec.
     */
    private static final Long NO_GROUP_SENTINEL = -1L;

    /**
     * Build the combined Specification from a filter object.
     * Order doesn't matter — JPA composes them into one WHERE clause.
     */
    public static Specification<Channel> build(ChannelFilter f) {
        return Specification.where(idContains(f.getId()))
                .and(nameContains(f.getName()))
                .and(searchIdOrName(f.getSearch()))
                .and(channelGroupEquals(f.getChannelGroupId()))
                .and(hasExportId(f.getExportType(), f.getExportId()))
                .and(hasSource(f.getSourceName(), f.getSourcePriority()));
    }

    /**
     * Single-box search: matches the channel id OR the name (case-insensitive
     * substring). Unlike {@link #idContains}/{@link #nameContains} — which the
     * caller AND-combines — this ORs the two so one query box finds a channel by
     * either field.
     */
    public static Specification<Channel> searchIdOrName(String q) {
        if (!StringUtils.hasText(q)) return null;
        String pattern = "%" + q.toLowerCase() + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("id")), pattern),
                cb.like(cb.lower(root.get("name")), pattern)
        );
    }

    public static Specification<Channel> idContains(String id) {
        if (!StringUtils.hasText(id)) return null;
        String pattern = "%" + id.toLowerCase() + "%";
        return (root, query, cb) -> cb.like(cb.lower(root.get("id")), pattern);
    }

    public static Specification<Channel> nameContains(String name) {
        if (!StringUtils.hasText(name)) return null;
        String pattern = "%" + name.toLowerCase() + "%";
        return (root, query, cb) -> cb.like(cb.lower(root.get("name")), pattern);
    }

    /**
     * Equals on channelGroupId. -1 means "is null" (no group assigned).
     */
    public static Specification<Channel> channelGroupEquals(Long groupId) {
        if (groupId == null) return null;
        if (NO_GROUP_SENTINEL.equals(groupId)) {
            return (root, query, cb) -> cb.isNull(root.get("channelGroupId"));
        }
        return (root, query, cb) -> cb.equal(root.get("channelGroupId"), groupId);
    }

    /**
     * Filter by export ID. Joins channel_export_id and applies type and/or value.
     * Caller can pass just type (any ID of that type), just value (any type with
     * matching ID substring), or both.
     */
    public static Specification<Channel> hasExportId(ChannelExportId.ExportType type, String externalIdSubstring) {
        if (type == null && !StringUtils.hasText(externalIdSubstring)) return null;
        return (root, query, cb) -> {
            // Inner join — channels without matching export IDs are excluded
            Join<Channel, ChannelExportId> join = root.join("exportIds", JoinType.INNER);

            jakarta.persistence.criteria.Predicate predicate = cb.conjunction();
            if (type != null) {
                predicate = cb.and(predicate, cb.equal(join.get("type"), type));
            }
            if (StringUtils.hasText(externalIdSubstring)) {
                predicate = cb.and(predicate,
                        cb.like(cb.lower(join.get("externalId")),
                                "%" + externalIdSubstring.toLowerCase() + "%"));
            }

            // distinct() to avoid duplicate channel rows when a channel has multiple
            // matching export IDs. Guard against the count query Spring Data fires for
            // pagination — Hibernate produces invalid SQL if distinct is set on it.
            if (query != null && !Long.class.equals(query.getResultType())) {
                query.distinct(true);
            }
            return predicate;
        };
    }

    /**
     * Filter by linked source name and/or its priority.
     * Joins channel_source -> source.
     */
    public static Specification<Channel> hasSource(String sourceName, Integer sourcePriority) {
        if (!StringUtils.hasText(sourceName) && sourcePriority == null) return null;
        return (root, query, cb) -> {
            Join<Channel, Source> sourceJoin = root.join("sources", JoinType.INNER);

            jakarta.persistence.criteria.Predicate predicate = cb.conjunction();
            if (StringUtils.hasText(sourceName)) {
                predicate = cb.and(predicate, cb.equal(sourceJoin.get("name"), sourceName));
            }
            if (sourcePriority != null) {
                predicate = cb.and(predicate, cb.equal(sourceJoin.get("priority"), sourcePriority));
            }

            if (query != null && !Long.class.equals(query.getResultType())) {
                query.distinct(true);
            }
            return predicate;
        };
    }
}