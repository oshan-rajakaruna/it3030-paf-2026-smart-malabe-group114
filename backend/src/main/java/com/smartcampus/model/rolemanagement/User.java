package com.smartcampus.model.rolemanagement;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Document(collection = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

  @Id
  private String id;

  private String name;

  @Indexed(unique = true)
  private String email;

  private String password;

  private UserRole role;

  private UserStatus status;

  @Indexed(unique = true, sparse = true)
  private String idNumber;

  private LocalDateTime createdAt;

  private LocalDateTime lastLoginAt;

  private String mfaSecret;

  private Boolean mfaEnabled;
}



