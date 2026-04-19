package com.smartcampus.repository.rolemanagement;

import java.util.List;
import java.util.Collection;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.smartcampus.model.rolemanagement.AppNotification;
import com.smartcampus.model.rolemanagement.NotificationAudienceRole;
import com.smartcampus.model.rolemanagement.NotificationStatus;

public interface NotificationRepository extends MongoRepository<AppNotification, String> {
  List<AppNotification> findByUserIdOrderByCreatedAtDesc(String userId);
  List<AppNotification> findByRoleInOrderByCreatedAtDesc(Collection<NotificationAudienceRole> roles);
  List<AppNotification> findByStatus(NotificationStatus status);
  List<AppNotification> findByCreatedByOrderByCreatedAtDesc(String createdBy);
}



