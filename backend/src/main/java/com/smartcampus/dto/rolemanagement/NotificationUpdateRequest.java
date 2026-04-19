package com.smartcampus.dto.rolemanagement;

import com.smartcampus.model.rolemanagement.NotificationAudienceRole;
import com.smartcampus.model.rolemanagement.NotificationChannel;
import com.smartcampus.model.rolemanagement.NotificationModule;
import com.smartcampus.model.rolemanagement.NotificationPriority;
import com.smartcampus.model.rolemanagement.NotificationStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NotificationUpdateRequest {
  @NotBlank(message = "Title is required")
  @Size(max = 120, message = "Title must be at most 120 characters")
  private String title;

  private String userId;

  @NotBlank(message = "Message is required")
  @Size(max = 600, message = "Message must be at most 600 characters")
  private String message;

  @NotNull(message = "Audience role is required")
  private NotificationAudienceRole role;

  @NotNull(message = "Module is required")
  private NotificationModule module;

  @NotNull(message = "Channel is required")
  private NotificationChannel channel;

  @NotNull(message = "Priority is required")
  private NotificationPriority priority;

  @NotNull(message = "Status is required")
  private NotificationStatus status;
}

