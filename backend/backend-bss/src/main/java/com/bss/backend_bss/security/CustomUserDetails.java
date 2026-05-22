package com.bss.backend_bss.security;

import com.bss.backend_bss.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * Adapts our User entity to Spring Security's UserDetails interface.
 *
 * Spring Security expects authorities prefixed with "ROLE_".
 * So Role.EDITOR → "ROLE_EDITOR", which lets you write:
 *   .hasRole("EDITOR")  in SecurityConfig  (Spring strips the ROLE_ prefix automatically)
 *   .hasAuthority("ROLE_EDITOR")  is also fine if you prefer to be explicit
 */
@RequiredArgsConstructor
public class CustomUserDetails implements UserDetails {

    private final User user;

    // Expose the raw entity so services can read id, displayName, etc.
    public User getUser() {
        return user;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getUsername();
    }

    // Account state — all driven by the `status` column

    @Override
    public boolean isAccountNonExpired() {
        return true; // no expiry concept in this schema
    }

    @Override
    public boolean isAccountNonLocked() {
        return true; // add a `locked` column later if needed
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    /**
     * Returning false here causes Spring Security to throw
     * DisabledException before it even checks the password.
     * Useful for soft-banning users without deleting their data.
     */
    @Override
    public boolean isEnabled() {
        return Boolean.TRUE.equals(user.getStatus());
    }
}