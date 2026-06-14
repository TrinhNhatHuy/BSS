package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.UserEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface UserEventRepository extends JpaRepository<UserEvent, Long> {

    /** A user's recent events (within the lookback window) — backs the taste profile. */
    List<UserEvent> findByUserIdAndCreateTimeGreaterThanEqual(Long userId, LocalDateTime since);

    /** Whether this user already has any events (seeder idempotency, cold-start hints). */
    boolean existsByUserId(Long userId);

    // --- global popularity aggregates (all users, within the window) -----------
    // Snapshot columns mean these need no join. Counts every event type equally
    // (popularity is intentionally coarse); the per-user profile is the place that
    // weights signal types. Result sets are small (≤ #categories / #channels /
    // #distinct show names), so these run cheaply on the scheduled refresh.

    @Query("SELECT e.category, COUNT(e) FROM UserEvent e " +
           "WHERE e.createTime >= :since AND e.category IS NOT NULL GROUP BY e.category")
    List<Object[]> popularityByCategory(@Param("since") LocalDateTime since);

    @Query("SELECT e.channelId, COUNT(e) FROM UserEvent e " +
           "WHERE e.createTime >= :since AND e.channelId IS NOT NULL GROUP BY e.channelId")
    List<Object[]> popularityByChannel(@Param("since") LocalDateTime since);

    @Query("SELECT e.programName, COUNT(e) FROM UserEvent e " +
           "WHERE e.createTime >= :since AND e.programName IS NOT NULL GROUP BY e.programName")
    List<Object[]> popularityByName(@Param("since") LocalDateTime since);
}
