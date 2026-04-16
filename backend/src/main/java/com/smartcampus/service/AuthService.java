package com.smartcampus.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartcampus.dto.LoginRequest;
import com.smartcampus.dto.LoginResponse;
import com.smartcampus.dto.OAuthLoginChallengeResponse;
import com.smartcampus.dto.OAuthLoginRequest;
import com.smartcampus.dto.OAuthOtpVerifyRequest;
import com.smartcampus.dto.OAuthSignupRequest;
import com.smartcampus.dto.SignupRequest;
import com.smartcampus.dto.SignupResponse;
import com.smartcampus.dto.TwoFactorQrResponse;
import com.smartcampus.exception.BadRequestException;
import com.smartcampus.exception.UnauthorizedException;
import com.smartcampus.model.AppNotification;
import com.smartcampus.model.NotificationStatus;
import com.smartcampus.model.NotificationType;
import com.smartcampus.model.User;
import com.smartcampus.model.UserRole;
import com.smartcampus.model.UserStatus;
import com.smartcampus.repository.ExistingIdRepository;
import com.smartcampus.repository.NotificationRepository;
import com.smartcampus.repository.UserRepository;
import com.smartcampus.util.QrCodeUtil;
import com.warrenstrange.googleauth.GoogleAuthenticator;
import com.warrenstrange.googleauth.GoogleAuthenticatorKey;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {
  private static final String GOOGLE_PROVIDER = "google";
  private static final String MFA_ISSUER = "SmartCampusHub";

  private final UserRepository userRepository;
  private final ExistingIdRepository existingIdRepository;
  private final NotificationRepository notificationRepository;
  private final PasswordEncoder passwordEncoder;
  private final QrCodeUtil qrCodeUtil;
  private final GoogleAuthenticator googleAuthenticator = new GoogleAuthenticator();

  @Transactional
  public SignupResponse signup(SignupRequest request) {
    log.info("SIGNUP SERVICE HIT");
    log.info("Processing signup for email={}, idNumber={}", request.getEmail(), request.getIdNumber());
    String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);
    String normalizedIdNumber = request.getIdNumber().trim().toUpperCase(Locale.ROOT);
    validateCampusEmail(normalizedEmail, normalizedIdNumber);
    UserRole resolvedRole = resolveRoleFromIdNumber(normalizedIdNumber);

    if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
      throw new BadRequestException("Email is already registered");
    }

    if (userRepository.existsByIdNumberIgnoreCase(normalizedIdNumber)) {
      throw new BadRequestException("ID number is already registered");
    }

    boolean knownId = existingIdRepository.existsByIdNumberIgnoreCase(normalizedIdNumber);
    log.info("existing_ids check for idNumber={} -> exists={}", normalizedIdNumber, knownId);
    UserStatus nextStatus = knownId ? UserStatus.APPROVED : UserStatus.PENDING;

    User saved = userRepository.save(
      User.builder()
        .name(request.getName().trim())
        .email(normalizedEmail)
        .password(passwordEncoder.encode(request.getPassword()))
        .role(resolvedRole)
        .status(nextStatus)
        .idNumber(normalizedIdNumber)
        .build()
    );
    userRepository.flush();
    log.info("USER SAVED TO DB");
    log.info("Saved user id={}, email={}, status={}", saved.getId(), saved.getEmail(), saved.getStatus());

    if (nextStatus == UserStatus.PENDING) {
      try {
        createAdminSignupNotifications(saved);
        log.info("Pending signup notification created for user id={}", saved.getId());
      } catch (Exception ex) {
        log.error("Failed to create pending-signup notifications for user id={}", saved.getId(), ex);
      }
    }

    return buildSignupResponse(saved, nextStatus);
  }

  private void validateCampusEmail(String normalizedEmail, String normalizedIdNumber) {
    if (!normalizedEmail.endsWith("@sliit.lk")) {
      throw new BadRequestException("Please use your SLIIT email address");
    }

    int atIndex = normalizedEmail.indexOf('@');
    String emailLocalPart = atIndex > 0 ? normalizedEmail.substring(0, atIndex) : "";
    if (!emailLocalPart.equalsIgnoreCase(normalizedIdNumber)) {
      throw new BadRequestException("Email must match ID number (example: IT9012 -> it9012@sliit.lk)");
    }
  }

  private UserRole resolveRoleFromIdNumber(String normalizedIdNumber) {
    if (normalizedIdNumber.startsWith("AD")) {
      return UserRole.ADMIN;
    }
    if (normalizedIdNumber.startsWith("TE")) {
      return UserRole.TECHNICIAN;
    }
    return UserRole.USER;
  }

  private void validateGoogleEmail(String normalizedEmail) {
    int atIndex = normalizedEmail.indexOf('@');
    if (atIndex <= 0) {
      throw new BadRequestException("Invalid Google email format");
    }
  }

  @Transactional
  public SignupResponse signupWithGoogle(OAuthSignupRequest request) {
    log.info("GOOGLE OAUTH SIGNUP HIT - email={}, idNumber={}", request.getEmail(), request.getIdNumber());
    String provider = request.getProvider().trim().toLowerCase(Locale.ROOT);
    if (!GOOGLE_PROVIDER.equals(provider)) {
      throw new BadRequestException("Only Google provider is supported for this flow");
    }

    String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);
    String normalizedIdNumber = request.getIdNumber().trim().toUpperCase(Locale.ROOT);
    validateGoogleEmail(normalizedEmail);

    UserRole derivedRole = resolveRoleFromIdNumber(normalizedIdNumber);
    if (request.getRole() != derivedRole) {
      log.warn(
        "Google signup role mismatch for email={}: selectedRole={}, derivedRole={} (derived role will be used)",
        normalizedEmail,
        request.getRole(),
        derivedRole
      );
    }

    boolean knownId = existingIdRepository.existsByIdNumberIgnoreCase(normalizedIdNumber);
    UserStatus nextStatus = knownId ? UserStatus.APPROVED : UserStatus.PENDING;

    User existingByEmail = userRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);
    User existingByIdNumber = userRepository.findByIdNumberIgnoreCase(normalizedIdNumber).orElse(null);

    if (existingByIdNumber != null && existingByEmail != null && !existingByIdNumber.getId().equals(existingByEmail.getId())) {
      throw new BadRequestException("ID number is already registered to another user");
    }
    if (existingByEmail == null && existingByIdNumber != null) {
      throw new BadRequestException("ID number is already registered");
    }

    User saved;
    UserStatus previousStatus = existingByEmail == null ? null : existingByEmail.getStatus();

    if (existingByEmail == null) {
      saved = userRepository.save(
        User.builder()
          .name(request.getName().trim())
          .email(normalizedEmail)
          .password(passwordEncoder.encode(UUID.randomUUID().toString()))
          .role(derivedRole)
          .status(nextStatus)
          .idNumber(normalizedIdNumber)
          .mfaEnabled(Boolean.FALSE)
          .build()
      );
    } else {
      if (existingByEmail.getIdNumber() != null && !existingByEmail.getIdNumber().equalsIgnoreCase(normalizedIdNumber)) {
        throw new BadRequestException("Email is already registered with another ID number");
      }
      existingByEmail.setName(request.getName().trim());
      existingByEmail.setRole(derivedRole);
      existingByEmail.setIdNumber(normalizedIdNumber);
      if (existingByEmail.getPassword() == null || existingByEmail.getPassword().isBlank()) {
        existingByEmail.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
      }
      if (existingByEmail.getStatus() != UserStatus.APPROVED) {
        existingByEmail.setStatus(nextStatus);
      }
      saved = userRepository.save(existingByEmail);
    }
    userRepository.flush();

    if (saved.getStatus() == UserStatus.PENDING && previousStatus != UserStatus.PENDING) {
      createAdminSignupNotifications(saved);
    }

    return buildSignupResponse(saved, saved.getStatus());
  }

  @Transactional
  public OAuthLoginChallengeResponse initiateGoogleLogin(OAuthLoginRequest request) {
    log.info("GOOGLE OAUTH LOGIN HIT - email={}", request.getEmail());
    String provider = request.getProvider().trim().toLowerCase(Locale.ROOT);
    if (!GOOGLE_PROVIDER.equals(provider)) {
      throw new BadRequestException("Only Google provider is supported for this flow");
    }

    User user = userRepository.findByEmailIgnoreCase(request.getEmail().trim().toLowerCase(Locale.ROOT))
      .orElseThrow(() -> new UnauthorizedException("No account found for this Google email. Please sign up first."));

    if (user.getStatus() == UserStatus.PENDING) {
      throw new UnauthorizedException("Waiting for admin approval");
    }
    if (user.getStatus() == UserStatus.REJECTED) {
      throw new UnauthorizedException("Your account has been rejected by admin");
    }

    if (request.getName() != null && !request.getName().isBlank()) {
      user.setName(request.getName().trim());
    }

    String secret = ensureMfaSecret(user);
    boolean setupRequired = !Boolean.TRUE.equals(user.getMfaEnabled());

    userRepository.save(user);

    return OAuthLoginChallengeResponse.builder()
      .id(user.getId())
      .name(user.getName())
      .email(user.getEmail())
      .role(user.getRole())
      .status(user.getStatus())
      .mfaRequired(true)
      .mfaSetupRequired(setupRequired)
      .otpAuthUrl(setupRequired ? buildOtpAuthUrl(user.getEmail(), secret) : null)
      .message(setupRequired
        ? "Set up Google Authenticator and enter the 6-digit code."
        : "Enter the 6-digit Google Authenticator code.")
      .build();
  }

  @Transactional
  public TwoFactorQrResponse getTwoFactorQr(String email) {
    String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
    User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
      .orElseThrow(() -> new UnauthorizedException("No account found for this email"));

    boolean hadSecret = user.getMfaSecret() != null && !user.getMfaSecret().isBlank();
    String secret = ensureMfaSecret(user);
    if (!hadSecret) {
      userRepository.save(user);
    }

    String otpAuthUrl = buildOtpAuthUrl(user.getEmail(), secret);
    String qrCodeBase64 = qrCodeUtil.toBase64Png(otpAuthUrl, 240, 240);

    return TwoFactorQrResponse.builder()
      .email(user.getEmail())
      .otpAuthUrl(otpAuthUrl)
      .qrCodeImageBase64(qrCodeBase64)
      .build();
  }

  @Transactional
  public LoginResponse verifyGoogleOtp(OAuthOtpVerifyRequest request) {
    User user = userRepository.findByEmailIgnoreCase(request.getEmail().trim().toLowerCase(Locale.ROOT))
      .orElseThrow(() -> new UnauthorizedException("No account found for this Google email"));

    if (user.getStatus() == UserStatus.PENDING) {
      throw new UnauthorizedException("Waiting for admin approval");
    }
    if (user.getStatus() == UserStatus.REJECTED) {
      throw new UnauthorizedException("Your account has been rejected by admin");
    }

    if (user.getMfaSecret() == null || user.getMfaSecret().isBlank()) {
      throw new BadRequestException("MFA setup is not initialized. Please sign in with Google again.");
    }

    boolean valid = googleAuthenticator.authorize(user.getMfaSecret(), request.getCode());
    if (!valid) {
      throw new UnauthorizedException("Invalid Google Authenticator code");
    }

    user.setMfaEnabled(Boolean.TRUE);
    user.setLastLoginAt(LocalDateTime.now());
    user = userRepository.save(user);

    return LoginResponse.builder()
      .id(user.getId())
      .name(user.getName())
      .email(user.getEmail())
      .role(user.getRole())
      .status(user.getStatus())
      .message("Google login successful")
      .build();
  }

  @Transactional
  public LoginResponse login(LoginRequest request) {
    User user = userRepository.findByEmailIgnoreCase(request.getEmail().trim().toLowerCase())
      .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

    if (!matchesPassword(request.getPassword(), user.getPassword())) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.getStatus() == UserStatus.PENDING) {
      throw new UnauthorizedException("Waiting for admin approval");
    }

    if (user.getStatus() == UserStatus.REJECTED) {
      throw new UnauthorizedException("Your account has been rejected by admin");
    }

    user.setLastLoginAt(LocalDateTime.now());
    user = userRepository.save(user);

    return LoginResponse.builder()
      .id(user.getId())
      .name(user.getName())
      .email(user.getEmail())
      .role(user.getRole())
      .status(user.getStatus())
      .message("Login successful")
      .build();
  }

  private SignupResponse buildSignupResponse(User user, UserStatus statusForMessage) {
    return SignupResponse.builder()
      .id(user.getId())
      .name(user.getName())
      .email(user.getEmail())
      .idNumber(user.getIdNumber())
      .role(user.getRole())
      .status(user.getStatus())
      .message(statusForMessage == UserStatus.APPROVED
        ? "Signup successful. Your account is approved."
        : "Signup successful. Waiting for admin approval.")
      .build();
  }

  private String buildOtpAuthUrl(String email, String secret) {
    String label = URLEncoder.encode(MFA_ISSUER + ":" + email, StandardCharsets.UTF_8);
    String issuer = URLEncoder.encode(MFA_ISSUER, StandardCharsets.UTF_8);
    return "otpauth://totp/" + label + "?secret=" + secret + "&issuer=" + issuer;
  }

  private String ensureMfaSecret(User user) {
    String secret = user.getMfaSecret();
    if (secret != null && !secret.isBlank()) {
      return secret;
    }

    GoogleAuthenticatorKey key = googleAuthenticator.createCredentials();
    secret = key.getKey();
    user.setMfaSecret(secret);
    user.setMfaEnabled(Boolean.FALSE);
    return secret;
  }

  private boolean matchesPassword(String rawPassword, String storedPassword) {
    if (storedPassword == null || storedPassword.isBlank()) {
      return false;
    }
    // Compatibility for legacy/plaintext seeded users in local DB.
    boolean looksLikeBcrypt =
      storedPassword.startsWith("$2a$")
        || storedPassword.startsWith("$2b$")
        || storedPassword.startsWith("$2y$");

    if (!looksLikeBcrypt) {
      return storedPassword.equals(rawPassword);
    }

    return passwordEncoder.matches(rawPassword, storedPassword);
  }

  private void createAdminSignupNotifications(User pendingUser) {
    String message = "New signup pending approval: " + pendingUser.getName() + " (" + pendingUser.getIdNumber() + ")";
    List<User> admins = userRepository.findByRole(UserRole.ADMIN);

    if (admins.isEmpty()) {
      notificationRepository.save(
        AppNotification.builder()
          .user(null)
          .message(message)
          .type(NotificationType.SIGNUP_REVIEW)
          .status(NotificationStatus.UNREAD)
          .build()
      );
      return;
    }

    List<AppNotification> notifications = admins.stream()
      .map(admin -> AppNotification.builder()
        .user(admin)
        .message(message)
        .type(NotificationType.SIGNUP_REVIEW)
        .status(NotificationStatus.UNREAD)
        .build())
      .toList();

    notificationRepository.saveAll(notifications);
  }
}
