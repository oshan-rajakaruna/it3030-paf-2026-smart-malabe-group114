package com.smartcampus.repository;

import com.smartcampus.entity.Resource;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ResourceRepository extends JpaRepository<Resource, Long> {
}