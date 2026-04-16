package com.smartcampus.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.smartcampus.model.AppNotification;
import com.smartcampus.model.NotificationStatus;

public interface NotificationRepository extends JpaRepository<AppNotification, Long> {
  List<AppNotification> findByUserId(Long userId);
  List<AppNotification> findByStatus(NotificationStatus status);
}
