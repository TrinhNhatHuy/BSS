package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.UserBookmark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface UserBookmarkRepository extends JpaRepository<UserBookmark, Long> {

    List<UserBookmark> findByUserIdOrderByCreateTimeDesc(Long userId);

    List<UserBookmark> findByUserIdAndProgramIdIn(Long userId, Collection<Long> programIds);

    boolean existsByUserIdAndProgramId(Long userId, Long programId);

    void deleteByUserIdAndProgramId(Long userId, Long programId);

    // --- recommendation signal queries ----------------------------------------
    // Bookmarks store only program_id + create_time, so we theta-join Program to
    // pull the category/channel/name/begin_time the recommender needs.

    /** A user's recent bookmarks as [category, channelId, name, beginTime, createTime] rows. */
    @Query("SELECT p.category, p.channelId, p.name, p.beginTime, b.createTime " +
           "FROM UserBookmark b, Program p " +
           "WHERE b.programId = p.id AND b.userId = :userId AND b.createTime >= :since")
    List<Object[]> findProfileRows(@Param("userId") Long userId, @Param("since") LocalDateTime since);

    @Query("SELECT p.category, COUNT(b) FROM UserBookmark b, Program p " +
           "WHERE b.programId = p.id AND b.createTime >= :since AND p.category IS NOT NULL GROUP BY p.category")
    List<Object[]> popularityByCategory(@Param("since") LocalDateTime since);

    @Query("SELECT p.channelId, COUNT(b) FROM UserBookmark b, Program p " +
           "WHERE b.programId = p.id AND b.createTime >= :since AND p.channelId IS NOT NULL GROUP BY p.channelId")
    List<Object[]> popularityByChannel(@Param("since") LocalDateTime since);

    @Query("SELECT p.name, COUNT(b) FROM UserBookmark b, Program p " +
           "WHERE b.programId = p.id AND b.createTime >= :since AND p.name IS NOT NULL GROUP BY p.name")
    List<Object[]> popularityByName(@Param("since") LocalDateTime since);
}
