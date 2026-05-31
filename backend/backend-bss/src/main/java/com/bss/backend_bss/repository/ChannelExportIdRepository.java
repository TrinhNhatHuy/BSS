package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.ChannelExportId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

/**
 * Read access to channel_export_id rows.
 *
 * The export feature bulk-loads the export IDs for a set of channels in one
 * query (instead of lazy-loading channel.exportIds per channel), keeping the
 * XLSX generation off the N+1 path.
 */
@Repository
public interface ChannelExportIdRepository
        extends JpaRepository<ChannelExportId, ChannelExportId.PK> {

    @Query("SELECT ce FROM ChannelExportId ce WHERE ce.channel.id IN :channelIds")
    List<ChannelExportId> findByChannelIds(@Param("channelIds") Collection<String> channelIds);
}