package com.smartcampus.dto.rolemanagement;

import com.smartcampus.model.rolemanagement.NotificationStatus;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NotificationStatusUpdateRequest {
  @NotNull(message = "Notification status is required")
  private NotificationStatus status;
}



