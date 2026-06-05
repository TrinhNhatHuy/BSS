package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.UserPreference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserPreferenceRepository extends JpaRepository<UserPreference, Long> {

    List<UserPreference> findByUserId(Long userId);

    /** Replace-semantics helper: wipe a user's preferences before re-inserting. */
    void deleteByUserId(Long userId);
}