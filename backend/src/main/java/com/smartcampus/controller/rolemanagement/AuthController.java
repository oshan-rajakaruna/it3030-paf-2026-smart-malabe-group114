package com.smartcampus.controller.rolemanagement;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;

import com.smartcampus.dto.rolemanagement.LoginRequest;
import com.smartcampus.dto.rolemanagement.LoginResponse;
import com.smartcampus.dto.rolemanagement.OAuthLoginChallengeResponse;
import com.smartcampus.dto.rolemanagement.OAuthLoginRequest;
import com.smartcampus.dto.rolemanagement.OAuthOtpVerifyRequest;
import com.smartcampus.dto.rolemanagement.OAuthSignupRequest;
import com.smartcampus.dto.rolemanagement.SignupRequest;
import com.smartcampus.dto.rolemanagement.SignupResponse;
import com.smartcampus.dto.rolemanagement.TwoFactorQrResponse;
import com.smartcampus.service.rolemanagement.AuthService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = {
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
})
@Validated
@RequiredArgsConstructor
@Slf4j
public class AuthController {

  private final AuthService authService;

  @PostMapping("/signup")
  public ResponseEntity<SignupResponse> signup(@Valid @RequestBody SignupRequest request) {
    log.info("SIGNUP API HIT");
    log.info("Signup payload received for email={}, idNumber={}", request.getEmail(), request.getIdNumber());
    SignupResponse response = authService.signup(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
  }

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
    log.info("LOGIN API HIT - email={}", request.getEmail());
    return ResponseEntity.ok(authService.login(request));
  }

  @PostMapping("/oauth/signup")
  public ResponseEntity<SignupResponse> signupWithGoogle(@Valid @RequestBody OAuthSignupRequest request) {
    log.info("GOOGLE OAUTH SIGNUP API HIT - email={}, idNumber={}", request.getEmail(), request.getIdNumber());
    return ResponseEntity.status(HttpStatus.CREATED).body(authService.signupWithGoogle(request));
  }

  @PostMapping("/oauth/login")
  public ResponseEntity<OAuthLoginChallengeResponse> loginWithGoogle(@Valid @RequestBody OAuthLoginRequest request) {
    log.info("GOOGLE OAUTH LOGIN API HIT - email={}", request.getEmail());
    return ResponseEntity.ok(authService.initiateGoogleLogin(request));
  }

  @PostMapping("/oauth/verify-otp")
  public ResponseEntity<LoginResponse> verifyGoogleOtp(@Valid @RequestBody OAuthOtpVerifyRequest request) {
    log.info("GOOGLE OAUTH OTP VERIFY API HIT - email={}", request.getEmail());
    return ResponseEntity.ok(authService.verifyGoogleOtp(request));
  }

  @GetMapping("/2fa/qr")
  public ResponseEntity<TwoFactorQrResponse> getTwoFactorQr(@RequestParam("email") String email) {
    log.info("2FA QR API HIT - email={}", email);
    return ResponseEntity.ok(authService.getTwoFactorQr(email));
  }
}



