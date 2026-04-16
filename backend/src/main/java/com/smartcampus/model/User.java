package com.smartcampus.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 150)
  private String name;

  @Column(nullable = false, unique = true, length = 190)
  private String email;

  @Column(nullable = false, length = 255)
  private String password;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 40)
  private UserRole role;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 40)
  private UserStatus status;

  @Column(name = "id_number", nullable = false, unique = true, length = 80)
  private String idNumber;

  @Column(name = "created_at", nullable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "last_login_at")
  private LocalDateTime lastLoginAt;

  @Column(name = "mfa_secret", length = 150)
  private String mfaSecret;

  @Column(name = "mfa_enabled", nullable = false)
  private Boolean mfaEnabled;

  @PrePersist
  void onCreate() {
    createdAt = LocalDateTime.now();
    if (mfaEnabled == null) {
      mfaEnabled = Boolean.FALSE;
    }
    if (email != null) {
      email = email.trim().toLowerCase();
    }
    if (idNumber != null) {
      idNumber = idNumber.trim().toUpperCase();
    }
  }
}
