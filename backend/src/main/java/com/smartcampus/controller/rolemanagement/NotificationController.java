package com.smartcampus.controller.rolemanagement;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartcampus.dto.rolemanagement.NotificationRequest;
import com.smartcampus.dto.rolemanagement.NotificationResponse;
import com.smartcampus.dto.rolemanagement.NotificationStatusUpdateRequest;
import com.smartcampus.service.rolemanagement.NotificationService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/notifications")
@Validated
@RequiredArgsConstructor
public class NotificationController {

  private final NotificationService notificationService;

  @PostMapping
  public ResponseEntity<NotificationResponse> create(@Valid @RequestBody NotificationRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(notificationService.create(request));
  }

  @GetMapping
  public ResponseEntity<List<NotificationResponse>> getAll() {
    return ResponseEntity.ok(notificationService.getAll());
  }

  @GetMapping("/{id}")
  public ResponseEntity<NotificationResponse> getById(@PathVariable String id) {
    return ResponseEntity.ok(notificationService.getById(id));
  }

  @GetMapping("/user/{userId}")
  public ResponseEntity<List<NotificationResponse>> getByUserId(@PathVariable String userId) {
    return ResponseEntity.ok(notificationService.getByUserId(userId));
  }

  @PutMapping("/{id}")
  public ResponseEntity<NotificationResponse> updateStatus(
    @PathVariable String id,
    @Valid @RequestBody NotificationStatusUpdateRequest request
  ) {
    return ResponseEntity.ok(notificationService.updateStatus(id, request.getStatus()));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    notificationService.delete(id);
    return ResponseEntity.noContent().build();
  }
}



