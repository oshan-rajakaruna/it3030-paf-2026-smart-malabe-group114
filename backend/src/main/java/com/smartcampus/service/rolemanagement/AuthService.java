package com.smartcampus.service.rolemanagement;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.smartcampus.dto.rolemanagement.LoginRequest;
import com.smartcampus.dto.rolemanagement.LoginResponse;
import com.smartcampus.dto.rolemanagement.OAuthLoginChallengeResponse;
import com.smartcampus.dto.rolemanagement.OAuthLoginRequest;
import com.smartcampus.dto.rolemanagement.OAuthOtpVerifyRequest;
import com.smartcampus.dto.rolemanagement.OAuthSignupRequest;
import com.smartcampus.dto.rolemanagement.SignupRequest;
import com.smartcampus.dto.rolemanagement.SignupResponse;
import com.smartcampus.dto.rolemanagement.TwoFactorQrResponse;
import com.smartcampus.exception.rolemanagement.BadRequestException;
import com.smartcampus.exception.rolemanagement.UnauthorizedException;
import com.smartcampus.model.rolemanagement.NotificationAudienceRole;
import com.smartcampus.model.rolemanagement.NotificationChannel;
import com.smartcampus.model.rolemanagement.NotificationModule;
import com.smartcampus.model.rolemanagement.NotificationPriority;
import com.smartcampus.model.rolemanagement.User;
import com.smartcampus.model.rolemanagement.UserRole;
import com.smartcampus.model.rolemanagement.UserStatus;
import com.smartcampus.repository.rolemanagement.ExistingIdRepository;
import com.smartcampus.repository.rolemanagement.UserRepository;
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
  private final NotificationService notificationService;
  private final PasswordEncoder passwordEncoder;
  private final QrCodeUtil qrCodeUtil;
  private final GoogleAuthenticator googleAuthenticator = new GoogleAuthenticator();

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
        .createdAt(LocalDateTime.now())
        .mfaEnabled(Boolean.FALSE)
        .build()
    );
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

    User existingByEmail = findPreferredUserByEmail(normalizedEmail);
    User existingByIdNumber = findPreferredUserByIdNumber(normalizedIdNumber);

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
          .createdAt(LocalDateTime.now())
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
      if (existingByEmail.getMfaEnabled() == null) {
        existingByEmail.setMfaEnabled(Boolean.FALSE);
      }
      if (existingByEmail.getStatus() != UserStatus.APPROVED) {
        existingByEmail.setStatus(nextStatus);
      }
      saved = userRepository.save(existingByEmail);
    }

    if (saved.getStatus() == UserStatus.PENDING && previousStatus != UserStatus.PENDING) {
      createAdminSignupNotifications(saved);
    }

    return buildSignupResponse(saved, saved.getStatus());
  }

  public OAuthLoginChallengeResponse initiateGoogleLogin(OAuthLoginRequest request) {
    log.info("GOOGLE OAUTH LOGIN HIT - email={}", request.getEmail());
    System.out.println("GOOGLE LOGIN HIT");
    String provider = request.getProvider() == null ? "" : request.getProvider().trim().toLowerCase(Locale.ROOT);
    String normalizedEmail = request.getEmail() == null ? "" : request.getEmail().trim().toLowerCase(Locale.ROOT);
    if (normalizedEmail.isBlank()) {
      return OAuthLoginChallengeResponse.builder()
        .email("")
        .role(UserRole.USER)
        .status(UserStatus.PENDING)
        .mfaRequired(false)
        .mfaSetupRequired(false)
        .message("Email is required")
        .build();
    }
    if (!GOOGLE_PROVIDER.equals(provider)) {
      return OAuthLoginChallengeResponse.builder()
        .email(normalizedEmail)
        .role(UserRole.USER)
        .status(UserStatus.PENDING)
        .mfaRequired(false)
        .mfaSetupRequired(false)
        .message("Only Google provider is supported for this flow")
        .build();
    }

    String fallbackName = (request.getName() == null || request.getName().isBlank())
      ? safeEmailLocalPart(normalizedEmail)
      : request.getName().trim();

    User user = findPreferredUserByEmail(normalizedEmail);
    if (user == null) {
      user = userRepository.save(
        User.builder()
          .name(fallbackName)
          .email(normalizedEmail)
          .password(passwordEncoder.encode(UUID.randomUUID().toString()))
          .role(UserRole.USER)
          .status(UserStatus.PENDING)
          .idNumber(null)
          .createdAt(LocalDateTime.now())
          .mfaEnabled(Boolean.FALSE)
          .build()
      );
      createAdminSignupNotifications(user);
    }

    boolean dirty = false;
    if (user.getRole() == null) {
      user.setRole(UserRole.USER);
      dirty = true;
    }
    if (user.getStatus() == null) {
      user.setStatus(UserStatus.PENDING);
      dirty = true;
    }

    if (request.getName() != null && !request.getName().isBlank() && !request.getName().trim().equals(user.getName())) {
      user.setName(request.getName().trim());
      dirty = true;
    }

    if (dirty) {
      user = userRepository.save(user);
    }

    UserStatus currentStatus = user.getStatus() == null ? UserStatus.PENDING : user.getStatus();
    if (currentStatus == UserStatus.PENDING) {
      return OAuthLoginChallengeResponse.builder()
        .id(user.getId())
        .name(user.getName())
        .email(user.getEmail())
        .role(user.getRole())
        .status(currentStatus)
        .mfaRequired(false)
        .mfaSetupRequired(false)
        .message("Waiting for admin approval")
        .build();
    }
    if (currentStatus == UserStatus.REJECTED) {
      return OAuthLoginChallengeResponse.builder()
        .id(user.getId())
        .name(user.getName())
        .email(user.getEmail())
        .role(user.getRole())
        .status(currentStatus)
        .mfaRequired(false)
        .mfaSetupRequired(false)
        .message("Your account has been rejected by admin")
        .build();
    }

    String secret = ensureMfaSecret(user);
    boolean setupRequired = !Boolean.TRUE.equals(user.getMfaEnabled());

    userRepository.save(user);

    return OAuthLoginChallengeResponse.builder()
      .id(user.getId())
      .name(user.getName())
      .email(user.getEmail())
      .role(user.getRole())
      .status(currentStatus)
      .mfaRequired(true)
      .mfaSetupRequired(setupRequired)
      .otpAuthUrl(setupRequired ? buildOtpAuthUrl(user.getEmail(), secret) : null)
      .message(setupRequired
        ? "Set up Google Authenticator and enter the 6-digit code."
        : "Enter the 6-digit Google Authenticator code.")
      .build();
  }

  public TwoFactorQrResponse getTwoFactorQr(String email) {
    String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
    User user = findPreferredUserByEmail(normalizedEmail);
    if (user == null) {
      throw new UnauthorizedException("No account found for this email");
    }

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

  public LoginResponse verifyGoogleOtp(OAuthOtpVerifyRequest request) {
    User user = findPreferredUserByEmail(request.getEmail().trim().toLowerCase(Locale.ROOT));
    if (user == null) {
      throw new UnauthorizedException("No account found for this Google email");
    }

    if (user.getRole() == null) {
      user.setRole(UserRole.USER);
    }
    if (user.getStatus() == null) {
      user.setStatus(UserStatus.PENDING);
    }

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

  public LoginResponse login(LoginRequest request) {
    String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);
    List<User> users = userRepository.findAllByEmailIgnoreCase(normalizedEmail);
    if (users.isEmpty()) {
      throw new UnauthorizedException("Invalid email or password");
    }

    User user = users.stream()
      .sorted(preferredUserComparator())
      .filter(candidate -> matchesPassword(request.getPassword(), candidate.getPassword()))
      .findFirst()
      .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

    if (user.getRole() == null) {
      user.setRole(UserRole.USER);
    }
    if (user.getStatus() == null) {
      user.setStatus(UserStatus.PENDING);
    }

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

  private String safeEmailLocalPart(String email) {
    int at = email == null ? -1 : email.indexOf('@');
    if (at > 0) {
      return email.substring(0, at);
    }
    return "Google User";
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

  private User findPreferredUserByEmail(String normalizedEmail) {
    List<User> users = userRepository.findAllByEmailIgnoreCase(normalizedEmail);
    if (users.isEmpty()) {
      return null;
    }
    if (users.size() > 1) {
      log.warn("Duplicate user records found for email={}. Using preferred record.", normalizedEmail);
    }
    return users.stream().sorted(preferredUserComparator()).findFirst().orElse(users.get(0));
  }

  private User findPreferredUserByIdNumber(String normalizedIdNumber) {
    List<User> users = userRepository.findAllByIdNumberIgnoreCase(normalizedIdNumber);
    if (users.isEmpty()) {
      return null;
    }
    if (users.size() > 1) {
      log.warn("Duplicate user records found for idNumber={}. Using preferred record.", normalizedIdNumber);
    }
    return users.stream().sorted(preferredUserComparator()).findFirst().orElse(users.get(0));
  }

  private Comparator<User> preferredUserComparator() {
    return Comparator
      .comparingInt((User user) -> statusPriority(user.getStatus()))
      .thenComparing(User::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
  }

  private int statusPriority(UserStatus status) {
    if (status == UserStatus.APPROVED) {
      return 0;
    }
    if (status == UserStatus.PENDING) {
      return 1;
    }
    if (status == UserStatus.REJECTED) {
      return 2;
    }
    return 3;
  }

  private void createAdminSignupNotifications(User pendingUser) {
    String safeIdNumber = pendingUser.getIdNumber() == null || pendingUser.getIdNumber().isBlank()
      ? "NO-ID"
      : pendingUser.getIdNumber();
    String message = "New signup pending approval: " + pendingUser.getName() + " (" + safeIdNumber + ")";
    notificationService.notifyRole(
      NotificationAudienceRole.ADMIN,
      "New Signup Request",
      message,
      NotificationModule.AUTH,
      NotificationPriority.HIGH,
      NotificationChannel.WEB,
      "SYSTEM"
    );
  }
}



