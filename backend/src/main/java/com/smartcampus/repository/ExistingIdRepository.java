package com.smartcampus.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.smartcampus.model.ExistingId;

public interface ExistingIdRepository extends JpaRepository<ExistingId, Long> {
  boolean existsByIdNumber(String idNumber);
  boolean existsByIdNumberIgnoreCase(String idNumber);
}
