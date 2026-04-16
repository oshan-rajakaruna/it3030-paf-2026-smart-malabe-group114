package com.smartcampus.repository;

import com.smartcampus.entity.BookingHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingHistoryRepository extends JpaRepository<BookingHistory, Long> {
}