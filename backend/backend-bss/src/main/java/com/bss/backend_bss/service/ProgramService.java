package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.program.ProgramFilter;
import com.bss.backend_bss.dto.program.ProgramResponse;
import com.bss.backend_bss.dto.program.UpdateProgramRequest;
import com.bss.backend_bss.entity.Channel;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.exception.InvalidReferenceException;
import com.bss.backend_bss.exception.ResourceNotFoundException;
import com.bss.backend_bss.repository.ChannelRepository;
import com.bss.backend_bss.repository.ProgramRepository;
import com.bss.backend_bss.specification.ProgramSpecifications;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProgramService {

    private final ProgramRepository programRepository;
    private final ChannelRepository channelRepository;

    /**
     * Paginated, filterable program list used by the editor index page.
     *
     * Channel names are bulk-resolved in one extra query (not per-row), the
     * same pattern ChannelService uses for channel_group names.
     */
    @Transactional(readOnly = true)
    public Page<ProgramResponse> list(ProgramFilter filter, Pageable pageable) {
        Page<Program> page = programRepository.findAll(
                ProgramSpecifications.build(filter),
                pageable
        );

        Map<String, String> channelNames = lookupChannelNames(page.getContent());
        return page.map(p -> toResponse(p, channelNames));
    }

    /**
     * Existing endpoint kept for ViewChannel.jsx: live (non-draft) programs for
     * a channel on a given date.
     *
     * @param channelId    channel id (e.g., "VTV1")
     * @param dateYyyymmdd 8-char date prefix matching program.begin_time prefix
     */
    @Transactional(readOnly = true)
    public List<ProgramResponse> listForChannelOnDate(String channelId, String dateYyyymmdd) {
        List<Program> programs = programRepository
                .findByChannelIdAndDraftBatchIdIsNullAndBeginTimeStartingWithOrderByBeginTimeAsc(
                        channelId, dateYyyymmdd);

        Map<String, String> channelNames = lookupChannelNames(programs);
        return programs.stream()
                .map(p -> toResponse(p, channelNames))
                .toList();
    }

    /**
     * Single program by id, used by the program detail page (ProgramDetails.jsx,
     * reached from the View action on the ViewChannel timeline).
     */
    @Transactional(readOnly = true)
    public ProgramResponse getById(Long id) {
        Program program = programRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Program not found: " + id));
        return toResponse(program, lookupChannelNames(List.of(program)));
    }

    /**
     * Edit a program's name, content, category, and times. Channel and
     * live/draft status are not editable here. Backs the Edit action on the
     * program detail page.
     */
    @Transactional
    public ProgramResponse update(Long id, UpdateProgramRequest req) {
        Program program = programRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Program not found: " + id));

        // begin_time/end_time are chronologically-sortable fixed-width strings,
        // so a lexical compare is a valid time compare.
        if (req.getEndTime().compareTo(req.getBeginTime()) <= 0) {
            throw new InvalidReferenceException("End time must be after begin time.");
        }

        program.setName(req.getName());
        program.setContent(req.getContent());
        program.setCategory(req.getCategory());
        program.setBeginTime(req.getBeginTime());
        program.setEndTime(req.getEndTime());

        Program saved = programRepository.save(program);
        return toResponse(saved, lookupChannelNames(List.of(saved)));
    }

    /** Permanently delete a program. Backs the Delete action on the detail page. */
    @Transactional
    public void delete(Long id) {
        if (!programRepository.existsById(id)) {
            throw new ResourceNotFoundException("Program not found: " + id);
        }
        programRepository.deleteById(id);
    }

    private Map<String, String> lookupChannelNames(List<Program> programs) {
        Set<String> ids = programs.stream()
                .map(Program::getChannelId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();

        return channelRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Channel::getId, Channel::getName));
    }

    private ProgramResponse toResponse(Program p, Map<String, String> channelNames) {
        return ProgramResponse.builder()
                .id(p.getId())
                .channelId(p.getChannelId())
                .channelName(p.getChannelId() == null ? null : channelNames.get(p.getChannelId()))
                .beginTime(p.getBeginTime())
                .endTime(p.getEndTime())
                .name(p.getName())
                .content(p.getContent())
                .category(p.getCategory())
                .draftBatchId(p.getDraftBatchId())
                .build();
    }
}