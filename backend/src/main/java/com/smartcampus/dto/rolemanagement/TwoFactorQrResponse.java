package com.smartcampus.dto.rolemanagement;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TwoFactorQrResponse {
  private String email;
  private String otpAuthUrl;
  private String qrCodeImageBase64;
}



