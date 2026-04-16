package com.smartcampus.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.smartcampus.model.User;
import com.smartcampus.model.UserRole;
import com.smartcampus.model.UserStatus;

public interface UserRepository extends JpaRepository<User, Long> {
  Optional<User> findByEmailIgnoreCase(String email);
  Optional<User> findByIdNumberIgnoreCase(String idNumber);
  boolean existsByEmailIgnoreCase(String email);
  boolean existsByIdNumber(String idNumber);
  boolean existsByIdNumberIgnoreCase(String idNumber);
  List<User> findByStatus(UserStatus status);
  List<User> findByRole(UserRole role);
}
