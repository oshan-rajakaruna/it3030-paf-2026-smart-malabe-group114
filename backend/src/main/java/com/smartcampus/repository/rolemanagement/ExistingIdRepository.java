package com.smartcampus.repository.rolemanagement;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.smartcampus.model.rolemanagement.ExistingId;

public interface ExistingIdRepository extends MongoRepository<ExistingId, String> {
  boolean existsByIdNumber(String idNumber);
  boolean existsByIdNumberIgnoreCase(String idNumber);
}



