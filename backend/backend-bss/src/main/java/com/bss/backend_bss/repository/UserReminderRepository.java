package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.UserReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserReminderRepository extends JpaRepository<UserReminder, Long> {

    Optional<UserReminder> findByUserIdAndProgramId(Long userId, Long programId);

    List<UserReminder> findByUserIdOrderByRemindAtAsc(Long userId);

    /** Which of these programs the user already has a reminder on (for badges). */
    List<UserReminder> findByUserIdAndProgramIdIn(Long userId, List<Long> programIds);

    /** Due, not-yet-sent reminders — the scheduler's hot query. */
    List<UserReminder> findByIsSentFalseAndRemindAtLessThanEqual(LocalDateTime now);

    void deleteByUserIdAndProgramId(Long userId, Long programId);

    // --- recommendation signal queries ----------------------------------------
    // Reminders are the strongest explicit signal. Theta-join Program to pull the
    // category/channel/name/begin_time the recommender needs.

    /** A user's recent reminders as [category, channelId, name, beginTime, createTime] rows. */
    @Query("SELECT p.category, p.channelId, p.name, p.beginTime, r.createTime " +
           "FROM UserReminder r, Program p " +
           "WHERE r.programId = p.id AND r.userId = :userId AND r.createTime >= :since")
    List<Object[]> findProfileRows(@Param("userId") Long userId, @Param("since") LocalDateTime since);

    @Query("SELECT p.category, COUNT(r) FROM UserReminder r, Program p " +
           "WHERE r.programId = p.id AND r.createTime >= :since AND p.category IS NOT NULL GROUP BY p.category")
    List<Object[]> popularityByCategory(@Param("since") LocalDateTime since);

    @Query("SELECT p.channelId, COUNT(r) FROM UserReminder r, Program p " +
           "WHERE r.programId = p.id AND r.createTime >= :since AND p.channelId IS NOT NULL GROUP BY p.channelId")
    List<Object[]> popularityByChannel(@Param("since") LocalDateTime since);

    @Query("SELECT p.name, COUNT(r) FROM UserReminder r, Program p " +
           "WHERE r.programId = p.id AND r.createTime >= :since AND p.name IS NOT NULL GROUP BY p.name")
    List<Object[]> popularityByName(@Param("since") LocalDateTime since);
}