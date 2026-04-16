package com.smartcampus.repository;

import com.smartcampus.entity.Checkin;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CheckinRepository extends JpaRepository<Checkin, Long> {
}