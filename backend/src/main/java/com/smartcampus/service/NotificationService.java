package com.smartcampus.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartcampus.dto.NotificationRequest;
import com.smartcampus.dto.NotificationResponse;
import com.smartcampus.exception.ResourceNotFoundException;
import com.smartcampus.model.AppNotification;
import com.smartcampus.model.NotificationStatus;
import com.smartcampus.model.User;
import com.smartcampus.repository.NotificationRepository;
import com.smartcampus.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationService {

  private final NotificationRepository notificationRepository;
  private final UserRepository userRepository;

  @Transactional(readOnly = true)
  public List<NotificationResponse> getAll() {
    return notificationRepository.findAll()
      .stream()
      .map(this::toResponse)
      .toList();
  }

  @Transactional(readOnly = true)
  public NotificationResponse getById(Long id) {
    AppNotification notification = notificationRepository.findById(id)
      .orElseThrow(() -> new ResourceNotFoundException("Notification not found for id " + id));
    return toResponse(notification);
  }

  @Transactional(readOnly = true)
  public List<NotificationResponse> getByUserId(Long userId) {
    return notificationRepository.findByUserId(userId)
      .stream()
      .map(this::toResponse)
      .toList();
  }

  @Transactional
  public NotificationResponse create(NotificationRequest request) {
    User user = null;
    if (request.getUserId() != null) {
      user = userRepository.findById(request.getUserId())
        .orElseThrow(() -> new ResourceNotFoundException("User not found for id " + request.getUserId()));
    }

    AppNotification saved = notificationRepository.save(
      AppNotification.builder()
        .user(user)
        .message(request.getMessage().trim())
        .type(request.getType())
        .status(request.getStatus() == null ? NotificationStatus.UNREAD : request.getStatus())
        .build()
    );

    return toResponse(saved);
  }

  @Transactional
  public NotificationResponse updateStatus(Long id, NotificationStatus status) {
    AppNotification notification = notificationRepository.findById(id)
      .orElseThrow(() -> new ResourceNotFoundException("Notification not found for id " + id));
    notification.setStatus(status);
    return toResponse(notificationRepository.save(notification));
  }

  @Transactional
  public void delete(Long id) {
    if (!notificationRepository.existsById(id)) {
      throw new ResourceNotFoundException("Notification not found for id " + id);
    }
    notificationRepository.deleteById(id);
  }

  private NotificationResponse toResponse(AppNotification notification) {
    return NotificationResponse.builder()
      .id(notification.getId())
      .userId(notification.getUser() == null ? null : notification.getUser().getId())
      .message(notification.getMessage())
      .type(notification.getType())
      .status(notification.getStatus())
      .createdAt(notification.getCreatedAt())
      .build();
  }
}
