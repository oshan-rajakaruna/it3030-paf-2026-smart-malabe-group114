package com.smartcampus.service.rolemanagement;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;

import com.smartcampus.dto.rolemanagement.UserResponse;
import com.smartcampus.exception.rolemanagement.ResourceNotFoundException;
import com.smartcampus.model.rolemanagement.AppNotification;
import com.smartcampus.model.rolemanagement.NotificationStatus;
import com.smartcampus.model.rolemanagement.NotificationType;
import com.smartcampus.model.rolemanagement.User;
import com.smartcampus.model.rolemanagement.UserStatus;
import com.smartcampus.repository.rolemanagement.NotificationRepository;
import com.smartcampus.repository.rolemanagement.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {

  private final UserRepository userRepository;
  private final NotificationRepository notificationRepository;

  public List<UserResponse> getAllUsers() {
    return userRepository.findAll()
      .stream()
      .sorted(Comparator.comparing(User::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
      .map(this::toResponse)
      .toList();
  }

  public List<UserResponse> getPendingUsers() {
    return userRepository.findByStatus(UserStatus.PENDING)
      .stream()
      .sorted(Comparator.comparing(User::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
      .map(this::toResponse)
      .toList();
  }

  public UserResponse approveUser(String id) {
    User user = userRepository.findById(id)
      .orElseThrow(() -> new ResourceNotFoundException("User not found for id " + id));
    user.setStatus(UserStatus.APPROVED);
    User saved = userRepository.save(user);

    notificationRepository.save(
      AppNotification.builder()
        .userId(saved.getId())
        .message("Your account has been approved. You can now log in.")
        .type(NotificationType.ACCOUNT_APPROVED)
        .status(NotificationStatus.UNREAD)
        .createdAt(LocalDateTime.now())
        .build()
    );
    return toResponse(saved);
  }

  public UserResponse rejectUser(String id) {
    User user = userRepository.findById(id)
      .orElseThrow(() -> new ResourceNotFoundException("User not found for id " + id));
    user.setStatus(UserStatus.REJECTED);
    User saved = userRepository.save(user);

    notificationRepository.save(
      AppNotification.builder()
        .userId(saved.getId())
        .message("Your account request was rejected by admin.")
        .type(NotificationType.ACCOUNT_REJECTED)
        .status(NotificationStatus.UNREAD)
        .createdAt(LocalDateTime.now())
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



