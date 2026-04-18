package com.smartcampus.dto.rolemanagement;

import java.time.LocalDateTime;

import com.smartcampus.model.rolemanagement.NotificationStatus;
import com.smartcampus.model.rolemanagement.NotificationType;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class NotificationResponse {
  private String id;
  private String userId;
  private String message;
  private NotificationType type;
  private NotificationStatus status;
  private LocalDateTime createdAt;
}



