package com.smartcampus.dto;

import com.smartcampus.model.NotificationStatus;
import com.smartcampus.model.NotificationType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NotificationRequest {
  private Long userId;

  @NotBlank(message = "Message is required")
  @Size(max = 600, message = "Message must be at most 600 characters")
  private String message;

  @NotNull(message = "Notification type is required")
  private NotificationType type;

  private NotificationStatus status;
}
