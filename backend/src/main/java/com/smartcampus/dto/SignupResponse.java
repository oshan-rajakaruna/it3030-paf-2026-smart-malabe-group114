package com.smartcampus.dto;

import com.smartcampus.model.UserRole;
import com.smartcampus.model.UserStatus;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SignupResponse {
  private Long id;
  private String name;
  private String email;
  private String idNumber;
  private UserRole role;
  private UserStatus status;
  private String message;
}
