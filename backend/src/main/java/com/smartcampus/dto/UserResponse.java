package com.smartcampus.dto;

import java.time.LocalDateTime;

import com.smartcampus.model.UserRole;
import com.smartcampus.model.UserStatus;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserResponse {
  private Long id;
  private String name;
  private String email;
  private String idNumber;
  private UserRole role;
  private UserStatus status;
  private LocalDateTime createdAt;
  private LocalDateTime lastLoginAt;
}
