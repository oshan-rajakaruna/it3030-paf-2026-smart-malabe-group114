package com.smartcampus.repository.rolemanagement;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.smartcampus.model.rolemanagement.User;
import com.smartcampus.model.rolemanagement.UserRole;
import com.smartcampus.model.rolemanagement.UserStatus;

public interface UserRepository extends MongoRepository<User, String> {
  Optional<User> findByEmailIgnoreCase(String email);
  Optional<User> findByIdNumberIgnoreCase(String idNumber);
  List<User> findAllByEmailIgnoreCase(String email);
  List<User> findAllByIdNumberIgnoreCase(String idNumber);
  boolean existsByEmailIgnoreCase(String email);
  boolean existsByIdNumber(String idNumber);
  boolean existsByIdNumberIgnoreCase(String idNumber);
  List<User> findByStatus(UserStatus status);
  List<User> findByRole(UserRole role);
}



