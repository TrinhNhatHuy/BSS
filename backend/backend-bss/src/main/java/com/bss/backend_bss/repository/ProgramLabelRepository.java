package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.ProgramLabel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProgramLabelRepository extends JpaRepository<ProgramLabel, Long> {

    Optional<ProgramLabel> findByProgramIdAndLabelSource(Long programId, ProgramLabel.LabelSource source);

    List<ProgramLabel> findByProgramIdInAndLabelSource(Collection<Long> programIds, ProgramLabel.LabelSource source);
}
