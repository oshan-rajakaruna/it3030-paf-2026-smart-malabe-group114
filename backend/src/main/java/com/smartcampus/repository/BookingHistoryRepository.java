package com.smartcampus.repository;

import com.smartcampus.entity.BookingHistory;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface BookingHistoryRepository extends MongoRepository<BookingHistory, String> {
}
