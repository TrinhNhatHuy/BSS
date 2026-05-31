package com.bss.backend_bss.config;

import com.bss.backend_bss.security.CustomUserDetailsService;
import com.bss.backend_bss.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Central Spring Security configuration.
 *
 * Key decisions:
 *  • Stateless session (JWT replaces HttpSession)
 *  • CSRF disabled (safe for stateless REST APIs; CSRF only matters for cookie-based sessions)
 *  • CORS configured to allow the React dev server (port 5173)
 *  • Role-based URL access:
 *      /api/auth/**     → public
 *      /api/editor/**   → EDITOR only
 *      /api/admin/**    → ADMIN only
 *      /api/user/**     → authenticated (any role)
 *      everything else  → authenticated
 *
 * @EnableMethodSecurity also enabled so you can add @PreAuthorize on individual
 * controller methods later if you need finer-grained control.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final CustomUserDetailsService userDetailsService;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // CORS: use our bean below
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // CSRF: disabled for stateless REST
                .csrf(AbstractHttpConfigurer::disable)

                // URL-based access rules
                .authorizeHttpRequests(auth -> auth

                        // Public: login, register, any future /api/auth/* endpoints
                        .requestMatchers("/api/auth/**").permitAll()

                        // EDITOR-only: schedule management, draft batches, AI review
                        .requestMatchers("/api/editor/**").hasRole("EDITOR")

                        // ADMIN-only: user management, source management, system config
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        // USER role: personalized schedule, bookmarks, reminders, search
                        .requestMatchers("/api/user/**").hasAnyRole("USER", "ADMIN", "EDITOR")
                        //  ADMIN and EDITOR can also hit user-facing endpoints if needed.
                        //   Change to .hasRole("USER") if you want strict separation.

                        // Everything else requires authentication (no anonymous access)
                        .anyRequest().authenticated()
                )

                // Session: stateless — no HttpSession created
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                // Authentication provider
                .authenticationProvider(authenticationProvider())

                // JWT filter runs BEFORE Spring's username/password filter
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // Authentication Provider

    /**
     * DaoAuthenticationProvider wires together:
     *   • Our CustomUserDetailsService (loads User from DB)
     *   • BCryptPasswordEncoder (verifies hashed passwords)
     *
     * AuthService.login() delegates to the AuthenticationManager which
     * internally uses this provider.
     */
    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    /**
     * Exposes AuthenticationManager as a bean so AuthService can inject it.
     * Spring Boot doesn't expose it automatically in Boot 3.x.
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    // Password Encoder

    /**
     * BCrypt with default strength (10 rounds). Defined here rather than a
     * separate config class to avoid circular bean dependency issues with
     * UserDetailsService.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // CORS Configuration

    /**
     * Allows the React Vite dev server to call our API.
     *
     * In production (Docker + Nginx), Nginx will serve the React build from
     * the same origin as the API, so CORS won't be needed. You can restrict
     * this to dev-only in application-prod.properties by setting
     * app.cors.allowed-origins to your actual production domain.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // Parse comma-separated origins from properties
        // e.g. "http://localhost:5173,https://bss.yourdomain.com"
        config.setAllowedOrigins(List.of(allowedOrigins.split(",")));

        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));

        // Allow all standard headers + the Authorization header for JWT
        config.setAllowedHeaders(List.of("*"));

        // Expose Authorization so axios can read it if needed, and
        // Content-Disposition so the export download can read the file name.
        config.setExposedHeaders(List.of("Authorization", "Content-Disposition"));

        // Required when allowCredentials is true (e.g., if you later add cookies)
        // Set to false if you don't need cookies
        config.setAllowCredentials(true);

        // Cache the preflight response for 1 hour (reduces OPTIONS requests)
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}