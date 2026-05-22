package com.bss.backend_bss.config;

import com.bss.backend_bss.entity.User;
import com.bss.backend_bss.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Creates test users on startup if they don't already exist.
 *
 * Only active when:
 *   1. The 'dev' Spring profile is active (application.properties → spring.profiles.active=dev)
 *   2. app.seed.enabled=true in application-dev.properties
 *
 * Set app.seed.enabled=false (or remove this class) before deploying to production.
 *
 * Seed accounts:
 *   editor1  / editor123  → EDITOR role
 *   admin1   / admin123   → ADMIN role
 *   user1    / user123    → USER role
 */
@Slf4j
@Configuration
@Profile("dev")
@RequiredArgsConstructor
public class DataSeeder {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.enabled:false}")
    private boolean seedEnabled;

    @Bean
    public CommandLineRunner seedUsers() {
        return args -> {
            if (!seedEnabled) {
                log.info("DataSeeder: seed disabled (app.seed.enabled=false). Skipping.");
                return;
            }

            createIfNotExists("editor1", "editor1@bss.local",
                    "editor123", "Editor One", User.Role.EDITOR);

            createIfNotExists("admin1", "admin1@bss.local",
                    "admin123", "Admin One", User.Role.ADMIN);

            createIfNotExists("user1", "user1@bss.local",
                    "user123456", "User One", User.Role.USER);

            log.info("DataSeeder: seed complete.");
        };
    }

    private void createIfNotExists(
            String username, String email,
            String rawPassword, String displayName,
            User.Role role
    ) {
        if (userRepository.existsByUsername(username)) {
            log.info("DataSeeder: '{}' already exists, skipping.", username);
            return;
        }

        User user = User.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(rawPassword))
                .displayName(displayName)
                .role(role)
                .status(true)
                .build();

        userRepository.save(user);
        log.info("DataSeeder: created {} account '{}'", role, username);
    }
}