package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.*;
import com.bss.backend_bss.entity.User;
import com.bss.backend_bss.exception.InvalidCredentialsException;
import com.bss.backend_bss.exception.UserAlreadyExistsException;
import com.bss.backend_bss.repository.UserRepository;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Authentication business logic.
 *
 * Keeping logic here (not in the controller) means:
 *  • Controllers stay thin — just request/response mapping
 *  • This service is independently unit-testable
 *  • Future features (audit log, email verification) are easy to add
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    @Value("${jwt.expiration-ms}")
    private long expirationMs;

    // Login

    /**
     * Authenticates a user and returns a signed JWT + user info.
     *
     * Delegates credential checking to Spring Security's AuthenticationManager
     * (which uses DaoAuthenticationProvider + BCrypt under the hood).
     * If authentication fails, Spring throws BadCredentialsException which we
     * wrap in our own InvalidCredentialsException for a cleaner error message.
     */
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getUsername(),
                            request.getPassword()
                    )
            );
        } catch (BadCredentialsException e) {
            // Don't reveal whether it's the username or password that's wrong
            throw new InvalidCredentialsException("Invalid username or password");
        } catch (DisabledException e) {
            throw new DisabledException("Account is disabled");
        }

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        User user = userDetails.getUser();

        String token = jwtService.generateToken(userDetails);
        log.info("User '{}' logged in with role '{}'", user.getUsername(), user.getRole());

        return buildAuthResponse(user, token);
    }

    // Register

    /**
     * Registers a new USER-role account.
     *
     * EDITOR and ADMIN accounts are created by ADMIN users through a separate
     * /api/admin/users endpoint (not implemented here). Self-registration
     * always produces USER role — never let the frontend dictate the role.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // Uniqueness checks before hitting the DB constraint
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new UserAlreadyExistsException(
                    "Username '" + request.getUsername() + "' is already taken");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new UserAlreadyExistsException(
                    "Email '" + request.getEmail() + "' is already registered");
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .displayName(
                        // Use username as display name if none provided
                        (request.getDisplayName() != null && !request.getDisplayName().isBlank())
                                ? request.getDisplayName()
                                : request.getUsername()
                )
                .role(User.Role.USER)   // ALWAYS USER — never trust the client for this
                .status(true)
                .build();

        user = userRepository.save(user);
        log.info("New USER account registered: '{}'", user.getUsername());

        // Wrap saved user in UserDetails to generate token
        com.bss.backend_bss.security.CustomUserDetails userDetails =
                new com.bss.backend_bss.security.CustomUserDetails(user);
        String token = jwtService.generateToken(userDetails);

        return buildAuthResponse(user, token);
    }

    // Get current user info

    /**
     * Returns info for the currently authenticated user.
     * Called by GET /api/auth/me — used by the React app on page refresh
     * to rehydrate auth state from the stored token.
     */
    public UserInfoResponse getCurrentUserInfo(CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        return UserInfoResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }

    // Private helpers

    private AuthResponse buildAuthResponse(User user, String token) {
        return AuthResponse.builder()
                .token(token)
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .role(user.getRole().name())   // "EDITOR" / "ADMIN" / "USER"
                .expiresIn(expirationMs)
                .build();
    }
}