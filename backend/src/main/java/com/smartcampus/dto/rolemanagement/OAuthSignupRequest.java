package com.smartcampus.dto.rolemanagement;

import com.smartcampus.model.rolemanagement.UserRole;
import com.fasterxml.jackson.annotation.JsonAlias;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OAuthSignupRequest {

  @NotBlank(message = "Name is required")
  @Size(max = 150, message = "Name must be at most 150 characters")
  private String name;

  @NotBlank(message = "Email is required")
  @Email(message = "Email format is invalid")
  private String email;

  @NotBlank(message = "ID number is required")
  @Size(max = 80, message = "ID number must be at most 80 characters")
  @Pattern(
    regexp = "^(?i)(IT|AD|TE)\\d{4}$",
    message = "ID number must be in format IT1234, AD1234, or TE1234"
  )
  @JsonAlias({ "id_number", "idnumber", "id", "studentId", "staffId" })
  private String idNumber;

  @NotNull(message = "Role is required")
  private UserRole role;

  @NotBlank(message = "Provider is required")
  private String provider;
}



