package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.user.ChangePasswordRequest;
import com.bss.backend_bss.dto.user.ProfileResponse;
import com.bss.backend_bss.dto.user.UpdateProfileRequest;
import com.bss.backend_bss.entity.User;
import com.bss.backend_bss.exception.DuplicateResourceException;
import com.bss.backend_bss.exception.InvalidReferenceException;
import com.bss.backend_bss.exception.ResourceNotFoundException;
import com.bss.backend_bss.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Self-service account management — a user reading and editing their OWN
 * account. The caller's id always comes from the authenticated principal, never
 * from the request body, so one user can never touch another's account here.
 */
@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public ProfileResponse getProfile(Long userId) {
        return toResponse(load(userId));
    }

    /** Update display name and/or email. Email must be unique across users. */
    @Transactional
    public ProfileResponse updateProfile(Long userId, UpdateProfileRequest req) {
        User user = load(userId);

        String email = blankToNull(req.getEmail());
        if (email != null) {
            userRepository.findByEmail(email).ifPresent(other -> {
                if (!other.getId().equals(userId)) {
                    throw new DuplicateResourceException("Email '" + email + "' is already registered");
                }
            });
        }
        user.setEmail(email);
        user.setDisplayName(blankToNull(req.getDisplayName()));

        return toResponse(userRepository.save(user));
    }

    /**
     * Change the user's password after re-verifying the current one.
     *
     * A wrong current password throws InvalidReferenceException (422) — NOT a
     * 401 — on purpose: the frontend's axios interceptor force-logs-out on 401,
     * which would be wrong here.
     */
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest req) {
        User user = load(userId);

        if (user.getPassword() == null
                || !passwordEncoder.matches(req.getCurrentPassword(), user.getPassword())) {
            throw new InvalidReferenceException("Current password is incorrect.");
        }

        user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
    }

    private User load(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private ProfileResponse toResponse(User u) {
        return ProfileResponse.builder()
                .id(u.getId())
                .username(u.getUsername())
                .email(u.getEmail())
                .displayName(u.getDisplayName())
                .role(u.getRole().name())
                .status(u.getStatus())
                .createTime(u.getCreateTime())
                .updateTime(u.getUpdateTime())
                .build();
    }
}