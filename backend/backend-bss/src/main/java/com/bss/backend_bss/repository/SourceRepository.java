package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.Source;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface SourceRepository extends JpaRepository<Source, String> {

    /** Used by create/update to validate every source name in the payload exists. */
    List<Source> findByNameIn(Collection<String> names);

    /** Status filter for the dropdown — only show active sources to editors. */
    List<Source> findByStatusTrueOrderByPriorityAscNameAsc();
}