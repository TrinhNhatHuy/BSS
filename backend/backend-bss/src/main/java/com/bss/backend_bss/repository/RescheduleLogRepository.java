package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.RescheduleLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * JpaSpecificationExecutor enables findAll(Specification, Pageable) for the
 * dynamic filter endpoint, mirroring ProgramRepository.
 */
@Repository
public interface RescheduleLogRepository
        extends JpaRepository<RescheduleLog, Long>, JpaSpecificationExecutor<RescheduleLog> {

    /**
     * Reschedule-log entries for a channel whose program falls on the given date
     * (YYYYMMDD prefix). Matches the new begin_time (ADDED/MODIFIED rows) or the
     * original begin_time (DELETED rows, whose begin_time is null). Shown as the
     * "Schedule Changes (today)" figure on ViewChannel.
     */
    @Query("SELECT COUNT(r) FROM RescheduleLog r WHERE r.channelId = :channelId " +
           "AND (r.beginTime LIKE CONCAT(:date, '%') OR r.originalBeginTime LIKE CONCAT(:date, '%'))")
    long countByChannelIdAndDate(@Param("channelId") String channelId, @Param("date") String yyyymmdd);
}