package com.smartcampus.repository;

import com.smartcampus.model.Checkin;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface CheckinRepository extends MongoRepository<Checkin, String> {
    boolean existsByBookingId(String bookingId);
}
