package com.smartcampus.service.rolemanagement;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.smartcampus.dto.rolemanagement.NotificationRequest;
import com.smartcampus.dto.rolemanagement.NotificationResponse;
import com.smartcampus.exception.rolemanagement.ResourceNotFoundException;
import com.smartcampus.model.rolemanagement.AppNotification;
import com.smartcampus.model.rolemanagement.NotificationStatus;
import com.smartcampus.repository.rolemanagement.NotificationRepository;
import com.smartcampus.repository.rolemanagement.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationService {

  private final NotificationRepository notificationRepository;
  private final UserRepository userRepository;

  public List<NotificationResponse> getAll() {
    return notificationRepository.findAll()
      .stream()
      .map(this::toResponse)
      .toList();
  }

  public NotificationResponse getById(String id) {
    AppNotification notification = notificationRepository.findById(id)
      .orElseThrow(() -> new ResourceNotFoundException("Notification not found for id " + id));
    return toResponse(notification);
  }

  public List<NotificationResponse> getByUserId(String userId) {
    return notificationRepository.findByUserId(userId)
      .stream()
      .map(this::toResponse)
      .toList();
  }

  public NotificationResponse create(NotificationRequest request) {
    String userId = null;
    if (request.getUserId() != null) {
      userRepository.findById(request.getUserId())
        .orElseThrow(() -> new ResourceNotFoundException("User not found for id " + request.getUserId()));
      userId = request.getUserId();
    }

    AppNotification saved = notificationRepository.save(
      AppNotification.builder()
        .userId(userId)
        .message(request.getMessage().trim())
        .type(request.getType())
        .status(request.getStatus() == null ? NotificationStatus.UNREAD : request.getStatus())
        .createdAt(LocalDateTime.now())
        .build()
    );

    return toResponse(saved);
  }

  public NotificationResponse updateStatus(String id, NotificationStatus status) {
    AppNotification notification = notificationRepository.findById(id)
      .orElseThrow(() -> new ResourceNotFoundException("Notification not found for id " + id));
    notification.setStatus(status);
    return toResponse(notificationRepository.save(notification));
  }

  public void delete(String id) {
    if (!notificationRepository.existsById(id)) {
      throw new ResourceNotFoundException("Notification not found for id " + id);
    }
    notificationRepository.deleteById(id);
  }

  private NotificationResponse toResponse(AppNotification notification) {
    return NotificationResponse.builder()
      .id(notification.getId())
      .userId(notification.getUserId())
      .message(notification.getMessage())
      .type(notification.getType())
      .status(notification.getStatus())
      .createdAt(notification.getCreatedAt())
      .build();
  }
}



