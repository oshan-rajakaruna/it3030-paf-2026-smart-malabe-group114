package com.smartcampus.repository;

import com.smartcampus.model.Resource;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ResourceRepository extends JpaRepository<Resource, Long> {

    Optional<Resource> findByResourceCode(String resourceCode);

    boolean existsByResourceCode(String resourceCode);
}
