package com.smartcampus.dto;

import com.smartcampus.model.UserRole;
import com.smartcampus.model.UserStatus;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class OAuthLoginChallengeResponse {
  private Long id;
  private String name;
  private String email;
  private UserRole role;
  private UserStatus status;
  private boolean mfaRequired;
  private boolean mfaSetupRequired;
  private String otpAuthUrl;
  private String message;
}
