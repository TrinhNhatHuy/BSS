package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.ChannelGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChannelGroupRepository extends JpaRepository<ChannelGroup, Long> {
}