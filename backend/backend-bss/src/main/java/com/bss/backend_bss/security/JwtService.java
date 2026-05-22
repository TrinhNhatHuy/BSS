package com.bss.backend_bss.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.function.Function;

/**
 * All JWT operations live here — generation, parsing, and validation.
 *
 * Uses the jjwt 0.12.x fluent API (Jwts.builder() / Jwts.parser()).
 * The secret is read from application-dev.properties → jwt.secret.
 */
@Slf4j
@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration-ms}")
    private long expirationMs;

    // Public API

    /**
     * Generates a signed JWT for the given user.
     *
     * Claims stored in the token:
     *   sub  → username  (standard JWT subject)
     *   role → "EDITOR" / "ADMIN" / "USER"  (custom claim — used by frontend for routing)
     *
     * We store the raw role string (not "ROLE_EDITOR") because the frontend
     * should not know or care about Spring Security's authority prefix convention.
     */
    public String generateToken(UserDetails userDetails) {
        // Extract the role string from the first (and only) authority: "ROLE_EDITOR" → "EDITOR"
        String roleAuthority = userDetails.getAuthorities().iterator().next().getAuthority();
        String role = roleAuthority.replace("ROLE_", "");

        return Jwts.builder()
                .subject(userDetails.getUsername())
                .claims(Map.of("role", role))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * Extracts the username (subject) from a token.
     * Returns null if the token is invalid / expired.
     */
    public String extractUsername(String token) {
        try {
            return extractClaim(token, Claims::getSubject);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Could not extract username from token: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Extracts the "role" custom claim: "EDITOR" / "ADMIN" / "USER".
     * Returns null if the token is invalid.
     */
    public String extractRole(String token) {
        try {
            return extractClaim(token, claims -> claims.get("role", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Could not extract role from token: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Returns true only if:
     *   1. The token is structurally valid and correctly signed.
     *   2. The token is not expired.
     *   3. The subject matches the provided UserDetails.
     *   4. The user account is still enabled (status = true in DB).
     */
    public boolean isTokenValid(String token, UserDetails userDetails) {
        try {
            String username = extractUsername(token);
            return username != null
                    && username.equals(userDetails.getUsername())
                    && !isTokenExpired(token)
                    && userDetails.isEnabled();
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Token validation failed: {}", e.getMessage());
            return false;
        }
    }

    // Private helpers

    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    /**
     * Parses and verifies the JWT signature. Throws JwtException if:
     *   - The signature is invalid (tampered token)
     *   - The token is expired
     *   - The token is malformed
     */
    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private boolean isTokenExpired(String token) {
        Date expiration = extractClaim(token, Claims::getExpiration);
        return expiration.before(new Date());
    }

    /**
     * Derives a cryptographic key from the secret string.
     * Keys.hmacShaKeyFor() produces an HS256/HS384/HS512 key depending on key length.
     * A 32-char secret (256 bits) → HS256. Fine for our use case.
     */
    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
}