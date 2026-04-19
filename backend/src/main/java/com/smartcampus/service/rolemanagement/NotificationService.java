package com.smartcampus.service.rolemanagement;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.smartcampus.dto.rolemanagement.NotificationRequest;
import com.smartcampus.dto.rolemanagement.NotificationResponse;
import com.smartcampus.dto.rolemanagement.NotificationUpdateRequest;
import com.smartcampus.exception.rolemanagement.BadRequestException;
import com.smartcampus.exception.rolemanagement.ResourceNotFoundException;
import com.smartcampus.model.rolemanagement.AppNotification;
import com.smartcampus.model.rolemanagement.NotificationAudienceRole;
import com.smartcampus.model.rolemanagement.NotificationChannel;
import com.smartcampus.model.rolemanagement.NotificationModule;
import com.smartcampus.model.rolemanagement.NotificationPriority;
import com.smartcampus.model.rolemanagement.NotificationStatus;
import com.smartcampus.model.rolemanagement.User;
import com.smartcampus.model.rolemanagement.UserRole;
import com.smartcampus.repository.rolemanagement.NotificationRepository;
import com.smartcampus.repository.rolemanagement.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationService {

  private static final String SYSTEM_ACTOR = "SYSTEM";

  private final NotificationRepository notificationRepository;
  private final UserRepository userRepository;

  public List<NotificationResponse> getAll() {
    return notificationRepository.findAll()
      .stream()
      .sorted(Comparator.comparing(AppNotification::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
      .map(this::toResponse)
      .toList();
  }

  public NotificationResponse getById(String id) {
    AppNotification notification = getEntity(id);
    return toResponse(notification);
  }

  public List<NotificationResponse> getByRole(String rawRole) {
    NotificationAudienceRole audienceRole = parseAudienceRole(rawRole);
    List<NotificationAudienceRole> allowedRoles = audienceRole == NotificationAudienceRole.ALL
      ? List.of(NotificationAudienceRole.ALL)
      : List.of(audienceRole, NotificationAudienceRole.ALL);

    return notificationRepository.findByRoleInOrderByCreatedAtDesc(allowedRoles)
      .stream()
      .filter(notification -> notification.getUserId() == null || notification.getUserId().isBlank())
      .map(this::toResponse)
      .toList();
  }

  public List<NotificationResponse> getByUserId(String userId) {
    if (userId == null || userId.isBlank()) {
      throw new BadRequestException("User id is required");
    }

    String resolvedUserId = resolveUserId(userId);
    User targetUser = userRepository.findById(resolvedUserId).orElse(null);
    NotificationAudienceRole userAudienceRole = targetUser == null
      ? NotificationAudienceRole.STUDENT
      : mapUserRoleToAudience(targetUser.getRole());
    List<AppNotification> broadcastRoleNotifications = notificationRepository.findByRoleInOrderByCreatedAtDesc(
      List.of(userAudienceRole, NotificationAudienceRole.ALL)
    ).stream()
      .filter(notification -> notification.getUserId() == null || notification.getUserId().isBlank())
      .toList();
    List<AppNotification> userTargeted = notificationRepository.findByUserIdOrderByCreatedAtDesc(resolvedUserId);
    List<AppNotification> rawUserTargeted = resolvedUserId.equals(userId)
      ? List.of()
      : notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);

    Map<String, AppNotification> deduped = new LinkedHashMap<>();
    broadcastRoleNotifications.forEach(notification -> deduped.put(notification.getId(), notification));
    userTargeted.forEach(notification -> deduped.put(notification.getId(), notification));
    rawUserTargeted.forEach(notification -> deduped.put(notification.getId(), notification));

    return deduped.values()
      .stream()
      .sorted(Comparator.comparing(AppNotification::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
      .map(this::toResponse)
      .toList();
  }

  public NotificationResponse create(NotificationRequest request) {
    validateRequest(request);
    AppNotification saved = notificationRepository.save(
      AppNotification.builder()
        .title(request.getTitle().trim())
        .message(request.getMessage().trim())
        .role(request.getRole())
        .userId(normalizeNullable(request.getUserId()))
        .module(request.getModule())
        .channel(request.getChannel())
        .priority(request.getPriority() == null ? NotificationPriority.NORMAL : request.getPriority())
        .status(request.getStatus() == null ? NotificationStatus.UNREAD : request.getStatus())
        .createdAt(LocalDateTime.now())
        .createdBy(normalizeNullable(request.getCreatedBy()) == null ? SYSTEM_ACTOR : normalizeNullable(request.getCreatedBy()))
        .build()
    );
    return toResponse(saved);
  }

  public NotificationResponse update(String id, NotificationUpdateRequest request) {
    validateUpdateRequest(request);
    AppNotification notification = getEntity(id);
    notification.setTitle(request.getTitle().trim());
    notification.setMessage(request.getMessage().trim());
    notification.setRole(request.getRole());
    notification.setUserId(normalizeNullable(request.getUserId()));
    notification.setModule(request.getModule());
    notification.setChannel(request.getChannel());
    notification.setPriority(request.getPriority());
    notification.setStatus(request.getStatus());

    AppNotification saved = notificationRepository.save(notification);
    return toResponse(saved);
  }

  public NotificationResponse markAsRead(String id) {
    AppNotification notification = getEntity(id);
    notification.setStatus(NotificationStatus.READ);
    AppNotification saved = notificationRepository.save(notification);
    return toResponse(saved);
  }

  public void delete(String id) {
    if (!notificationRepository.existsById(id)) {
      throw new ResourceNotFoundException("Notification not found for id " + id);
    }
    notificationRepository.deleteById(id);
  }

  public NotificationResponse notifyRole(
    NotificationAudienceRole role,
    String title,
    String message,
    NotificationModule module,
    NotificationPriority priority,
    NotificationChannel channel,
    String createdBy
  ) {
    AppNotification saved = notificationRepository.save(
      AppNotification.builder()
        .title(title.trim())
        .message(message.trim())
        .role(role)
        .userId(null)
        .module(module)
        .channel(channel)
        .priority(priority == null ? NotificationPriority.NORMAL : priority)
        .status(NotificationStatus.UNREAD)
        .createdAt(LocalDateTime.now())
        .createdBy(createdBy == null || createdBy.isBlank() ? SYSTEM_ACTOR : createdBy.trim())
        .build()
    );
    return toResponse(saved);
  }

  public NotificationResponse notifyUser(
    String userId,
    String title,
    String message,
    NotificationModule module,
    NotificationPriority priority,
    NotificationChannel channel,
    String createdBy
  ) {
    if (userId == null || userId.isBlank()) {
      throw new BadRequestException("userId is required for targeted user notifications");
    }

    User user = userRepository.findById(userId).orElse(null);
    NotificationAudienceRole derivedRole = user == null
      ? NotificationAudienceRole.STUDENT
      : mapUserRoleToAudience(user.getRole());

    AppNotification saved = notificationRepository.save(
      AppNotification.builder()
        .title(title.trim())
        .message(message.trim())
        .role(derivedRole)
        .userId(userId.trim())
        .module(module)
        .channel(channel)
        .priority(priority == null ? NotificationPriority.NORMAL : priority)
        .status(NotificationStatus.UNREAD)
        .createdAt(LocalDateTime.now())
        .createdBy(createdBy == null || createdBy.isBlank() ? SYSTEM_ACTOR : createdBy.trim())
        .build()
    );
    return toResponse(saved);
  }

  private void validateRequest(NotificationRequest request) {
    if (request.getRole() == null) {
      throw new BadRequestException("Audience role is required");
    }
    if (request.getRole() != NotificationAudienceRole.ALL && request.getUserId() != null && !request.getUserId().isBlank()) {
      userRepository.findById(request.getUserId())
        .orElseThrow(() -> new ResourceNotFoundException("User not found for id " + request.getUserId()));
    }
  }

  private void validateUpdateRequest(NotificationUpdateRequest request) {
    if (request.getRole() != NotificationAudienceRole.ALL && request.getUserId() != null && !request.getUserId().isBlank()) {
      userRepository.findById(request.getUserId())
        .orElseThrow(() -> new ResourceNotFoundException("User not found for id " + request.getUserId()));
    }
  }

  private AppNotification getEntity(String id) {
    return notificationRepository.findById(id)
      .orElseThrow(() -> new ResourceNotFoundException("Notification not found for id " + id));
  }

  private String normalizeNullable(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private String resolveUserId(String value) {
    String normalized = value.trim();
    if (userRepository.existsById(normalized)) {
      return normalized;
    }

    return userRepository.findByEmailIgnoreCase(normalized)
      .map(User::getId)
      .orElse(normalized);
  }

  private NotificationAudienceRole parseAudienceRole(String role) {
    if (role == null || role.isBlank()) {
      throw new BadRequestException("Role is required");
    }

    String normalized = role.trim().toUpperCase(Locale.ROOT);
    if ("USER".equals(normalized)) {
      normalized = "STUDENT";
    }

    try {
      return NotificationAudienceRole.valueOf(normalized);
    } catch (IllegalArgumentException ex) {
      throw new BadRequestException("Unsupported role: " + role);
    }
  }

  private NotificationAudienceRole mapUserRoleToAudience(UserRole userRole) {
    if (userRole == null) {
      return NotificationAudienceRole.STUDENT;
    }
    return switch (userRole) {
      case ADMIN -> NotificationAudienceRole.ADMIN;
      case TECHNICIAN -> NotificationAudienceRole.TECHNICIAN;
      case USER -> NotificationAudienceRole.STUDENT;
    };
  }

  private NotificationResponse toResponse(AppNotification notification) {
    return NotificationResponse.builder()
      .id(notification.getId())
      .title(notification.getTitle())
      .role(notification.getRole())
      .userId(notification.getUserId())
      .message(notification.getMessage())
      .module(notification.getModule())
      .channel(notification.getChannel())
      .priority(notification.getPriority())
      .status(notification.getStatus())
      .createdAt(notification.getCreatedAt())
      .createdBy(notification.getCreatedBy())
      .build();
  }
}
