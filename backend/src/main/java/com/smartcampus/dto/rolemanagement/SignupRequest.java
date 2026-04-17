package com.smartcampus.dto.rolemanagement;

import com.smartcampus.model.rolemanagement.UserRole;
import com.fasterxml.jackson.annotation.JsonAlias;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SignupRequest {

  @NotBlank(message = "Name is required")
  @Size(max = 150, message = "Name must be at most 150 characters")
  private String name;

  @NotBlank(message = "Email is required")
  @Email(message = "Email format is invalid")
  private String email;

  @NotBlank(message = "Password is required")
  @Size(min = 6, max = 100, message = "Password must be between 6 and 100 characters")
  private String password;

  private UserRole role;

  @JsonAlias({ "id_number", "idnumber", "id", "studentId", "staffId" })
  @NotBlank(message = "ID number is required")
  @Size(max = 80, message = "ID number must be at most 80 characters")
  private String idNumber;
}



