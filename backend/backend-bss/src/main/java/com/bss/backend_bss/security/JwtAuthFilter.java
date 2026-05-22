package com.bss.backend_bss.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Runs once per HTTP request, BEFORE Spring Security's own authentication filters.
 *
 * Flow:
 *   1. Read "Authorization: Bearer <token>" header.
 *   2. Extract username from token.
 *   3. Load user from DB.
 *   4. Validate token against that user.
 *   5. If valid → populate SecurityContextHolder so the rest of the chain
 *      knows this request is authenticated.
 *
 * If anything fails (missing header, bad token, unknown user) we simply don't
 * set the SecurityContext. The request continues, and Spring Security's
 * AuthorizationFilter will reject it with 401/403 if the route is protected.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        // 1. Extract the Authorization header
        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            // No token present — pass through; unauthenticated routes will still work.
            filterChain.doFilter(request, response);
            return;
        }

        // 2. Parse the token
        final String token = authHeader.substring(7); // strip "Bearer "
        final String username = jwtService.extractUsername(token);

        // Only proceed if we got a username AND the SecurityContext is empty
        // (i.e. this request isn't already authenticated from an earlier filter).
        if (username == null || SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Load user from DB
        UserDetails userDetails;
        try {
            userDetails = userDetailsService.loadUserByUsername(username);
        } catch (Exception e) {
            // User deleted from DB after token was issued.
            log.warn("JWT references unknown user '{}': {}", username, e.getMessage());
            filterChain.doFilter(request, response);
            return;
        }

        // 4. Validate token
        if (!jwtService.isTokenValid(token, userDetails)) {
            log.warn("Invalid or expired JWT for user '{}'", username);
            filterChain.doFilter(request, response);
            return;
        }

        // 5. Authenticate the request
        UsernamePasswordAuthenticationToken authToken =
                new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,                       // credentials — null after authentication
                        userDetails.getAuthorities()
                );
        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

        SecurityContextHolder.getContext().setAuthentication(authToken);
        log.debug("Authenticated user '{}' with role '{}'", username,
                userDetails.getAuthorities());

        filterChain.doFilter(request, response);
    }

    /**
     * Skip this filter entirely for public auth endpoints.
     * Without this, even /api/auth/login would run through JWT validation
     * (and fail, since there's no token on a fresh login request).
     */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return path.startsWith("/api/auth/");
    }
}