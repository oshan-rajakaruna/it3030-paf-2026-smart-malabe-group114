package com.smartcampus.service;

import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartcampus.dto.UserResponse;
import com.smartcampus.exception.ResourceNotFoundException;
import com.smartcampus.model.AppNotification;
import com.smartcampus.model.NotificationStatus;
import com.smartcampus.model.NotificationType;
import com.smartcampus.model.User;
import com.smartcampus.model.UserStatus;
import com.smartcampus.repository.NotificationRepository;
import com.smartcampus.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {

  private final UserRepository userRepository;
  private final NotificationRepository notificationRepository;

  @Transactional(readOnly = true)
  public List<UserResponse> getAllUsers() {
    return userRepository.findAll()
      .stream()
      .sorted(Comparator.comparing(User::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
      .map(this::toResponse)
      .toList();
  }

  @Transactional(readOnly = true)
  public List<UserResponse> getPendingUsers() {
    return userRepository.findByStatus(UserStatus.PENDING)
      .stream()
      .sorted(Comparator.comparing(User::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
      .map(this::toResponse)
      .toList();
  }

  @Transactional
  public UserResponse approveUser(Long id) {
    User user = userRepository.findById(id)
      .orElseThrow(() -> new ResourceNotFoundException("User not found for id " + id));
    user.setStatus(UserStatus.APPROVED);
    User saved = userRepository.save(user);

    notificationRepository.save(
      AppNotification.builder()
        .user(saved)
        .message("Your account has been approved. You can now log in.")
        .type(NotificationType.ACCOUNT_APPROVED)
        .status(NotificationStatus.UNREAD)
        .build()
    );
    return toResponse(saved);
  }

  @Transactional
  public UserResponse rejectUser(Long id) {
    User user = userRepository.findById(id)
      .orElseThrow(() -> new ResourceNotFoundException("User not found for id " + id));
    user.setStatus(UserStatus.REJECTED);
    User saved = userRepository.save(user);

    notificationRepository.save(
      AppNotification.builder()
        .user(saved)
        .message("Your account request was rejected by admin.")
        .type(NotificationType.ACCOUNT_REJECTED)
        .status(NotificationStatus.UNREAD)
        .build()
    );
    return toResponse(saved);
  }

  private UserResponse toResponse(User user) {
    return UserResponse.builder()
      .id(user.getId())
      .name(user.getName())
      .email(user.getEmail())
      .idNumber(user.getIdNumber())
      .role(user.getRole())
      .status(user.getStatus())
      .createdAt(user.getCreatedAt())
      .lastLoginAt(user.getLastLoginAt())
      .build();
  }
}
