package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.UserBookmark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface UserBookmarkRepository extends JpaRepository<UserBookmark, Long> {

    List<UserBookmark> findByUserIdOrderByCreateTimeDesc(Long userId);

    List<UserBookmark> findByUserIdAndProgramIdIn(Long userId, Collection<Long> programIds);

    boolean existsByUserIdAndProgramId(Long userId, Long programId);

    void deleteByUserIdAndProgramId(Long userId, Long programId);
}
