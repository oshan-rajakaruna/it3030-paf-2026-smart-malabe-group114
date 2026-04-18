package com.smartcampus.model.rolemanagement;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Document(collection = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppNotification {

  @Id
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



