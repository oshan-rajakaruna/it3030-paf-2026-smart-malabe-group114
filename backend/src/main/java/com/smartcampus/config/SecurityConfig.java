package com.smartcampus.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
            // Disable CSRF (for testing / frontend integration)
            .csrf(csrf -> csrf.disable())

            // Authorize requests
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                        "/", 
                        "/login**", 
                        "/error**", 
                        "/oauth2/**", 
                        "/api/test"
                ).permitAll()
                .anyRequest().authenticated()
            )

            // Enable Google OAuth2 Login
            .oauth2Login(oauth -> oauth
                // After successful login → redirect to frontend dashboard
                .defaultSuccessUrl("http://localhost:5173/dashboard", true)
            )

            // Logout config (optional but good)
            .logout(logout -> logout
                .logoutSuccessUrl("http://localhost:5173/login")
                .permitAll()
            );

        return http.build();
    }
}