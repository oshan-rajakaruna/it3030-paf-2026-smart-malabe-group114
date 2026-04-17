package com.smartcampus.dto.rolemanagement;

import com.smartcampus.model.rolemanagement.NotificationStatus;
import com.smartcampus.model.rolemanagement.NotificationType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NotificationRequest {
  private String userId;

  @NotBlank(message = "Message is required")
  @Size(max = 600, message = "Message must be at most 600 characters")
  private String message;

  @NotNull(message = "Notification type is required")
  private NotificationType type;

  private NotificationStatus status;
}



