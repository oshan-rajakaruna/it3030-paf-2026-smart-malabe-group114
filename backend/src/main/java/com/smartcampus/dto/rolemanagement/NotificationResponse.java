package com.smartcampus.dto.rolemanagement;

import java.time.LocalDateTime;

import com.smartcampus.model.rolemanagement.NotificationStatus;
import com.smartcampus.model.rolemanagement.NotificationAudienceRole;
import com.smartcampus.model.rolemanagement.NotificationChannel;
import com.smartcampus.model.rolemanagement.NotificationModule;
import com.smartcampus.model.rolemanagement.NotificationPriority;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class NotificationResponse {
  private String id;
  private String title;
  private NotificationAudienceRole role;
  private String userId;
  private String message;
  private NotificationModule module;
  private NotificationChannel channel;
  private NotificationPriority priority;
  private NotificationStatus status;
  private LocalDateTime createdAt;
  private String createdBy;
}



