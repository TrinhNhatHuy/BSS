package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.user.WatchLinkResponse;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Builds "Watch on tv360" deep links for USER channel pages.
 *
 * A channel is mapped to tv360 by storing its canonical tv360 URL as a
 * {@code channel_export_id} row of type TV360 (e.g.
 * {@code https://tv360.vn/tv/vtv2-hd?ch=3}). From that we know the slug + channel
 * id ({@code ch}); the program's tv360 schedule-item id ({@code pid}) — needed to
 * open a specific program's replay — is not derivable from the begin time, so we
 * fetch it from tv360's public schedule API and match by start epoch.
 *
 * Link rule (mirrors how the live channel page behaves):
 *   • program hasn't started yet → channel live URL (you can't watch it yet)
 *   • program matched in tv360's schedule and still airing → URL + &pid (LIVE)
 *   • program matched and already ended & replayable → URL + &pid (REPLAY)
 *   • ended but not replayable, or no schedule match → channel live URL
 *
 * The schedule API is public (no auth); responses are cached per channel+day.
 */
@Slf4j
@Service
public class Tv360Service {

    private static final DateTimeFormatter BEGIN_FMT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    /** A program's begin time must land within this window of a tv360 item to match. */
    private static final long MATCH_TOLERANCE_MS = 180_000; // 3 minutes
    private static final long CACHE_TTL_MS = 30 * 60_000;   // 30 minutes

    /** /tv/<slug> ... ch=<digits> — tolerant of extra params and ordering. */
    private static final Pattern SLUG_RE = Pattern.compile("/tv/([a-z0-9-]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern CH_RE = Pattern.compile("(?:[?&]ch=|:)(\\d+)");

    private final String apiBase;
    private final ZoneId zone;
    private final RestClient client = RestClient.create();
    private final ConcurrentHashMap<String, CachedDay> cache = new ConcurrentHashMap<>();

    public Tv360Service(
            @Value("${app.tv360.api-base:https://api.tv360.vn}") String apiBase,
            @Value("${app.reminder.zone:Asia/Ho_Chi_Minh}") String zone) {
        this.apiBase = apiBase;
        this.zone = ZoneId.of(zone);
    }

    // --- public API -----------------------------------------------------------

    /** A channel's tv360 identity parsed from its stored mapping. */
    public record Tv360Channel(String slug, int ch) {
        public String channelUrl() {
            return "https://tv360.vn/tv/" + slug + "?ch=" + ch;
        }
    }

    /**
     * Parse a TV360 {@code channel_export_id.external_id} into {slug, ch}. Accepts
     * a full tv360 URL, a bare {@code <slug>?ch=<id>}, or {@code <slug>:<id>}.
     */
    public Optional<Tv360Channel> parseMapping(String externalId) {
        if (externalId == null || externalId.isBlank()) return Optional.empty();
        Matcher slugM = SLUG_RE.matcher(externalId);
        Matcher chM = CH_RE.matcher(externalId);
        String slug = slugM.find() ? slugM.group(1) : null;
        // colon form "slug:ch" has no /tv/ prefix — take the part before the colon.
        if (slug == null && externalId.contains(":") && !externalId.contains("://")) {
            slug = externalId.substring(0, externalId.indexOf(':')).trim();
        }
        if (slug == null || slug.isBlank() || !chM.find()) return Optional.empty();
        try {
            return Optional.of(new Tv360Channel(slug, Integer.parseInt(chM.group(1))));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    /**
     * Resolve the URL to open for {@code program} on {@code channel}'s tv360 page.
     *
     * @param externalId the channel's TV360 mapping (stored external_id)
     * @param beginTime  program begin in YYYYMMDDHHMMSS (VN wall-clock)
     */
    public WatchLinkResponse resolveWatchLink(String externalId, String beginTime) {
        Optional<Tv360Channel> mapping = parseMapping(externalId);
        if (mapping.isEmpty()) {
            return WatchLinkResponse.builder().available(false).build();
        }
        Tv360Channel ch = mapping.get();
        String channelUrl = ch.channelUrl();

        LocalDateTime begin;
        try {
            begin = LocalDateTime.parse(beginTime, BEGIN_FMT);
        } catch (Exception e) {
            return WatchLinkResponse.builder().available(true).url(channelUrl).kind("CHANNEL").build();
        }
        long beginMs = begin.atZone(zone).toInstant().toEpochMilli();
        long nowMs = System.currentTimeMillis();

        // Not started yet — there's nothing to deep-link to; open the live channel.
        if (beginMs > nowMs) {
            return WatchLinkResponse.builder().available(true).url(channelUrl).kind("UPCOMING").build();
        }

        // Started: try to match a tv360 schedule item to get its pid.
        ScheduleItem item = findItem(ch.ch(), begin.toLocalDate(), beginMs);
        if (item == null) {
            return WatchLinkResponse.builder().available(true).url(channelUrl).kind("CHANNEL").build();
        }
        boolean ended = nowMs >= item.epochEt();
        if (ended && !item.replay()) {
            // Over and no catch-up — the pid link wouldn't play; fall back to live.
            return WatchLinkResponse.builder().available(true).url(channelUrl).kind("CHANNEL").build();
        }
        return WatchLinkResponse.builder()
                .available(true)
                .url(channelUrl + "&pid=" + item.pid())
                .kind(ended ? "REPLAY" : "LIVE")
                .build();
    }

    // --- schedule fetch + cache ----------------------------------------------

    private record ScheduleItem(String pid, long epochSt, long epochEt, boolean replay) {}

    private record CachedDay(List<ScheduleItem> items, long expiresAt) {}

    /** Closest schedule item to {@code beginMs} within tolerance, or null. */
    private ScheduleItem findItem(int ch, LocalDate date, long beginMs) {
        ScheduleItem best = null;
        long bestDiff = Long.MAX_VALUE;
        for (ScheduleItem it : schedule(ch, date)) {
            long diff = Math.abs(it.epochSt() - beginMs);
            if (diff < bestDiff) {
                bestDiff = diff;
                best = it;
            }
        }
        return bestDiff <= MATCH_TOLERANCE_MS ? best : null;
    }

    private List<ScheduleItem> schedule(int ch, LocalDate date) {
        String key = ch + "|" + date;
        CachedDay cached = cache.get(key);
        if (cached != null && cached.expiresAt() > System.currentTimeMillis()) {
            return cached.items();
        }
        List<ScheduleItem> items = fetchSchedule(ch, date);
        cache.put(key, new CachedDay(items, System.currentTimeMillis() + CACHE_TTL_MS));
        return items;
    }

    private List<ScheduleItem> fetchSchedule(int ch, LocalDate date) {
        List<ScheduleItem> out = new ArrayList<>();
        try {
            JsonNode resp = client.get()
                    .uri(apiBase + "/public/v1/live/get-live-schedule?id={id}&datetime={dt}", ch, date.toString())
                    .header("User-Agent", "BSS/1.0")
                    .header("Referer", "https://tv360.vn/")
                    .retrieve()
                    .body(JsonNode.class);
            JsonNode schedules = resp == null ? null : resp.path("data").path("schedules");
            if (schedules != null && schedules.isArray()) {
                for (JsonNode s : schedules) {
                    String pid = s.path("id").asText(null);
                    long st = s.path("epochSt").asLong(0);
                    if (pid == null || st == 0) continue;
                    out.add(new ScheduleItem(
                            pid, st,
                            s.path("epochEt").asLong(st),
                            s.path("isReplay").asInt(0) == 1));
                }
            }
        } catch (Exception e) {
            // tv360 down / changed — degrade to channel-only links (no pid).
            log.debug("tv360 get-live-schedule failed for ch={} date={}: {}", ch, date, e.getMessage());
        }
        return out;
    }
}