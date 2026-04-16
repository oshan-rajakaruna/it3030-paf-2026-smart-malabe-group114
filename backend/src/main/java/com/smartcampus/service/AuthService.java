package com.smartcampus.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartcampus.dto.LoginRequest;
import com.smartcampus.dto.LoginResponse;
import com.smartcampus.dto.SignupRequest;
import com.smartcampus.dto.SignupResponse;
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

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

  private final UserRepository userRepository;
  private final ExistingIdRepository existingIdRepository;
  private final NotificationRepository notificationRepository;
  private final PasswordEncoder passwordEncoder;

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

    return SignupResponse.builder()
      .id(saved.getId())
      .name(saved.getName())
      .email(saved.getEmail())
      .idNumber(saved.getIdNumber())
      .role(saved.getRole())
      .status(saved.getStatus())
      .message(nextStatus == UserStatus.APPROVED
        ? "Signup successful. Your account is approved."
        : "Signup successful. Waiting for admin approval.")
      .build();
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
