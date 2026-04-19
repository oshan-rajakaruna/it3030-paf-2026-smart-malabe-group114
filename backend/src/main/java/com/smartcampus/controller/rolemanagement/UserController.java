package com.smartcampus.controller.rolemanagement;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartcampus.dto.rolemanagement.UserResponse;
import com.smartcampus.service.rolemanagement.UserService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

  private final UserService userService;

  @GetMapping
  public ResponseEntity<List<UserResponse>> getAllUsers() {
    return ResponseEntity.ok(userService.getAllUsers());
  }

  @GetMapping("/pending")
  public ResponseEntity<List<UserResponse>> getPendingUsers() {
    return ResponseEntity.ok(userService.getPendingUsers());
  }

  @PutMapping("/{id}/approve")
  public ResponseEntity<UserResponse> approveUser(@PathVariable String id) {
    return ResponseEntity.ok(userService.approveUser(id));
  }

  @PutMapping("/{id}/reject")
  public ResponseEntity<UserResponse> rejectUser(@PathVariable String id) {
    return ResponseEntity.ok(userService.rejectUser(id));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> deleteUser(@PathVariable String id) {
    userService.deleteUser(id);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{id}/delete")
  public ResponseEntity<Void> deleteUserFallback(@PathVariable String id) {
    userService.deleteUser(id);
    return ResponseEntity.noContent().build();
  }
}



