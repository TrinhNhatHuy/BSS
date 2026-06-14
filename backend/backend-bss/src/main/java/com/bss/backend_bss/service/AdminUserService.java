package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.admin.AdminUserResponse;
import com.bss.backend_bss.dto.admin.CreateUserRequest;
import com.bss.backend_bss.entity.User;
import com.bss.backend_bss.exception.ResourceNotFoundException;
import com.bss.backend_bss.exception.UserAlreadyExistsException;
import com.bss.backend_bss.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Account management for the ADMIN role (backs /api/admin/users).
 *
 * Guard rails: an admin can never act on their own account, and ADMIN accounts
 * can't be created, re-roled, disabled, or deleted from here (ADMINs are made via
 * DB/seed) — so this UI can't escalate privileges or lock the admin out.
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public Page<AdminUserResponse> list(String q, String role,
                                        LocalDate createdFrom, LocalDate createdTo,
                                        Pageable pageable) {
        User.Role roleFilter = (role == null || role.isBlank()) ? null : parseRole(role);

        Specification<User> spec = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                ps.add(cb.or(
                        cb.like(cb.lower(root.<String>get("username")), like),
                        cb.like(cb.lower(cb.coalesce(root.<String>get("displayName"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.<String>get("email"), "")), like)
                ));
            }
            if (roleFilter != null) {
                ps.add(cb.equal(root.get("role"), roleFilter));
            }
            if (createdFrom != null) {
                ps.add(cb.greaterThanOrEqualTo(root.<LocalDateTime>get("createTime"), createdFrom.atStartOfDay()));
            }
            if (createdTo != null) {
                ps.add(cb.lessThan(root.<LocalDateTime>get("createTime"), createdTo.plusDays(1).atStartOfDay()));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };

        return userRepository.findAll(spec, pageable).map(this::toResponse);
    }

    @Transactional
    public AdminUserResponse create(CreateUserRequest req) {
        User.Role role = assignableRole(req.getRole());

        if (userRepository.existsByUsername(req.getUsername())) {
            throw new UserAlreadyExistsException("Username '" + req.getUsername() + "' is already taken");
        }
        if (req.getEmail() != null && userRepository.existsByEmail(req.getEmail())) {
            throw new UserAlreadyExistsException("Email '" + req.getEmail() + "' is already registered");
        }

        User user = User.builder()
                .username(req.getUsername())
                .email(req.getEmail())
                .password(passwordEncoder.encode(req.getPassword()))
                .displayName((req.getDisplayName() != null && !req.getDisplayName().isBlank())
                        ? req.getDisplayName() : req.getUsername())
                .role(role)
                .status(true)
                .build();
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public AdminUserResponse setRole(Long id, String role, Long actingId) {
        User user = target(id, actingId);
        user.setRole(assignableRole(role));
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public AdminUserResponse setStatus(Long id, boolean status, Long actingId) {
        User user = target(id, actingId);
        user.setStatus(status);
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void delete(Long id, Long actingId) {
        User user = target(id, actingId);
        // flush so a FK conflict (e.g. authored draft batches) surfaces here as a
        // DataIntegrityViolationException → friendly 409, not a commit-time 500.
        userRepository.delete(user);
        userRepository.flush();
    }

    // --- helpers --------------------------------------------------------------

    /** Load a non-self, non-ADMIN target or fail with a clear message. */
    private User target(Long id, Long actingId) {
        if (id.equals(actingId)) {
            throw new IllegalArgumentException("You can't perform this action on your own account.");
        }
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
        if (user.getRole() == User.Role.ADMIN) {
            throw new IllegalArgumentException("Admin accounts can't be modified or deleted here.");
        }
        return user;
    }

    private User.Role parseRole(String role) {
        try {
            return User.Role.valueOf(role.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid role: " + role);
        }
    }

    /** Parse a role and forbid ADMIN (can't create/assign admins from the UI). */
    private User.Role assignableRole(String role) {
        User.Role r = parseRole(role);
        if (r == User.Role.ADMIN) {
            throw new IllegalArgumentException("ADMIN accounts can't be created or assigned here.");
        }
        return r;
    }

    private AdminUserResponse toResponse(User u) {
        return AdminUserResponse.builder()
                .id(u.getId())
                .username(u.getUsername())
                .email(u.getEmail())
                .displayName(u.getDisplayName())
                .role(u.getRole().name())
                .status(Boolean.TRUE.equals(u.getStatus()))
                .createTime(u.getCreateTime())
                .updateTime(u.getUpdateTime())
                .build();
    }
}