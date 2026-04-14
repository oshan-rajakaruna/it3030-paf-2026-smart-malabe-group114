package com.smartcampus.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.util.UriUtils;

@Configuration
public class SecurityConfig {
  @Bean
  public SecurityFilterChain securityFilterChain(
    HttpSecurity http,
    OAuth2AuthorizationRequestResolver authorizationRequestResolver
  ) throws Exception {
    http
      .cors(cors -> cors.configurationSource(corsConfigurationSource()))
      .authorizeHttpRequests(auth -> auth
        .requestMatchers("/oauth2/**", "/login/**").permitAll()
        .anyRequest().authenticated()
      )
      .oauth2Login(oauth -> oauth
        .authorizationEndpoint(endpoint -> endpoint.authorizationRequestResolver(authorizationRequestResolver))
        .successHandler(oauth2SuccessHandler())
      )
      .logout(logout -> logout.logoutSuccessUrl("/"));

    return http.build();
  }

  @Bean
  public AuthenticationSuccessHandler oauth2SuccessHandler() {
    return (request, response, authentication) -> {
      if (!(authentication instanceof OAuth2AuthenticationToken token)) {
        response.sendRedirect("http://localhost:5173/login");
        return;
      }

      OAuth2User oauthUser = token.getPrincipal();
      String email = oauthUser.getAttribute("email");
      if (email == null || email.isBlank()) {
        response.sendRedirect("http://localhost:5173/login");
        return;
      }

      String encodedEmail = UriUtils.encode(email, java.nio.charset.StandardCharsets.UTF_8);
      response.sendRedirect("http://localhost:5173/dashboard?oauth=google&email=" + encodedEmail);
    };
  }

  @Bean
  public OAuth2AuthorizationRequestResolver authorizationRequestResolver(
    ClientRegistrationRepository clientRegistrationRepository
  ) {
    DefaultOAuth2AuthorizationRequestResolver resolver =
      new DefaultOAuth2AuthorizationRequestResolver(clientRegistrationRepository, "/oauth2/authorization");
    resolver.setAuthorizationRequestCustomizer(customizer ->
      customizer.additionalParameters(params -> params.put("prompt", "select_account"))
    );
    return resolver;
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();
    configuration.setAllowedOrigins(List.of("http://localhost:5173"));
    configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    configuration.setAllowedHeaders(List.of("*"));
    configuration.setAllowCredentials(true);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
  }
}
