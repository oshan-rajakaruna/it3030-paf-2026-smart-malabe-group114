package com.smartcampus.repository.rolemanagement;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.smartcampus.model.rolemanagement.AppNotification;
import com.smartcampus.model.rolemanagement.NotificationStatus;

public interface NotificationRepository extends MongoRepository<AppNotification, String> {
  List<AppNotification> findByUserId(String userId);
  List<AppNotification> findByStatus(NotificationStatus status);
}



