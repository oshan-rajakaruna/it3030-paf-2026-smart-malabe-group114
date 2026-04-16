package com.smartcampus.dto;

import java.time.LocalDateTime;

import com.smartcampus.model.NotificationStatus;
import com.smartcampus.model.NotificationType;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class NotificationResponse {
  private Long id;
  private Long userId;
  private String message;
  private NotificationType type;
  private NotificationStatus status;
  private LocalDateTime createdAt;
}
