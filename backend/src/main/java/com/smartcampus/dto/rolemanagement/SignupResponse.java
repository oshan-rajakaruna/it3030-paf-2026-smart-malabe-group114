package com.smartcampus.dto.rolemanagement;

import com.smartcampus.model.rolemanagement.UserRole;
import com.smartcampus.model.rolemanagement.UserStatus;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SignupResponse {
  private String id;
  private String name;
  private String email;
  private String idNumber;
  private UserRole role;
  private UserStatus status;
  private String message;
}



