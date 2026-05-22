package com.bss.backend_bss.security;

import com.bss.backend_bss.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Spring Security calls this when it needs to load a user by username —
 * both during login (AuthenticationManager) and on every JWT-authenticated request
 * (JwtAuthFilter). Keeping the logic here means one place to add future checks
 * (e.g. check status before returning, log suspicious logins, etc.).
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return userRepository
                .findByUsername(username)
                .map(CustomUserDetails::new)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "User not found with username: " + username
                ));
    }
}