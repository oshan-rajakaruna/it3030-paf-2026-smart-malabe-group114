package com.smartcampus.service.rolemanagement;

import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;

import com.smartcampus.dto.rolemanagement.UserResponse;
import com.smartcampus.exception.rolemanagement.ResourceNotFoundException;
import com.smartcampus.model.rolemanagement.NotificationChannel;
import com.smartcampus.model.rolemanagement.NotificationModule;
import com.smartcampus.model.rolemanagement.NotificationPriority;
import com.smartcampus.model.rolemanagement.User;
import com.smartcampus.model.rolemanagement.UserRole;
import com.smartcampus.model.rolemanagement.UserStatus;
import com.smartcampus.repository.rolemanagement.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {

  private final UserRepository userRepository;
  private final NotificationService notificationService;

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
    UserStatus previousStatus = user.getStatus();
    user.setStatus(UserStatus.APPROVED);
    User saved = userRepository.save(user);
    if (previousStatus != UserStatus.APPROVED) {
      try {
        notificationService.notifyUser(
          saved.getId(),
          "Account Approved",
          "Your account has been approved. You can now log in.",
          NotificationModule.AUTH,
          NotificationPriority.HIGH,
          NotificationChannel.WEB,
          "ADMIN"
        );
      } catch (Exception ignored) {
        // Avoid breaking approval flow when notification persistence fails.
      }
    }
    return toResponse(saved);
  }

  public UserResponse rejectUser(String id) {
    User user = userRepository.findById(id)
      .orElseThrow(() -> new ResourceNotFoundException("User not found for id " + id));
    UserStatus previousStatus = user.getStatus();
    user.setStatus(UserStatus.REJECTED);
    User saved = userRepository.save(user);
    if (previousStatus != UserStatus.REJECTED) {
      try {
        notificationService.notifyUser(
          saved.getId(),
          "Account Rejected",
          "Your account request was rejected by admin.",
          NotificationModule.AUTH,
          NotificationPriority.HIGH,
          NotificationChannel.WEB,
          "ADMIN"
        );
      } catch (Exception ignored) {
        // Avoid breaking rejection flow when notification persistence fails.
      }
    }
    return toResponse(saved);
  }

  public void deleteUser(String id) {
    User user = userRepository.findById(id)
      .orElseThrow(() -> new ResourceNotFoundException("User not found for id " + id));
    userRepository.deleteById(user.getId());
  }

  private UserResponse toResponse(User user) {
    return UserResponse.builder()
      .id(user.getId())
      .name(user.getName())
      .email(user.getEmail())
      .idNumber(user.getIdNumber())
      .role(normalizeRole(user.getRole()))
      .status(user.getStatus())
      .createdAt(user.getCreatedAt())
      .lastLoginAt(user.getLastLoginAt())
      .build();
  }

  private UserRole normalizeRole(UserRole role) {
    return role == UserRole.Student ? UserRole.USER : role;
  }
}



