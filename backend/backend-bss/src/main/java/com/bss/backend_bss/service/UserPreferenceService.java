package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.user.PreferenceResponse;
import com.bss.backend_bss.entity.Program;
import com.bss.backend_bss.entity.UserPreference;
import com.bss.backend_bss.exception.InvalidReferenceException;
import com.bss.backend_bss.repository.UserPreferenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;

/**
 * Read/replace a user's favourite categories (1–2). Replace-semantics: setting
 * preferences wipes the old rows and inserts the new ones — matching the project
 * convention for collection updates.
 */
@Service
@RequiredArgsConstructor
public class UserPreferenceService {

    private final UserPreferenceRepository repository;

    @Transactional(readOnly = true)
    public PreferenceResponse get(Long userId) {
        List<String> categories = repository.findByUserId(userId).stream()
                .map(p -> p.getCategory().name())
                .toList();
        return PreferenceResponse.builder().categories(categories).build();
    }

    @Transactional
    public PreferenceResponse set(Long userId, List<String> categories) {
        LinkedHashSet<Program.Category> parsed = new LinkedHashSet<>();
        if (categories != null) {
            for (String c : categories) {
                if (c == null || c.isBlank()) continue;
                try {
                    parsed.add(Program.Category.valueOf(c.trim()));
                } catch (IllegalArgumentException e) {
                    throw new InvalidReferenceException("Unknown category: " + c);
                }
            }
        }
        if (parsed.isEmpty() || parsed.size() > 2) {
            throw new InvalidReferenceException("Pick 1 or 2 categories.");
        }

        // Replace: delete then re-insert. Flush the delete first so the unique
        // (user_id, category) constraint doesn't trip on re-inserted categories.
        repository.deleteByUserId(userId);
        repository.flush();

        List<String> saved = parsed.stream()
                .map(cat -> repository.save(
                        UserPreference.builder().userId(userId).category(cat).build()).getCategory().name())
                .toList();

        return PreferenceResponse.builder().categories(saved).build();
    }
}