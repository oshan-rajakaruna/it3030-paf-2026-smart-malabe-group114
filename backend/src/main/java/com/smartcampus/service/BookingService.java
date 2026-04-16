package com.smartcampus.service;

import com.smartcampus.entity.Booking;
import com.smartcampus.repository.BookingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class BookingService {

    @Autowired
    private BookingRepository repo;

    public Booking createBooking(Booking booking) {
        booking.setStatus("PENDING");
        booking.setCreatedAt(LocalDateTime.now());
        return repo.save(booking);
    }

    public List<Booking> getAllBookings() {
        return repo.findAll();
    }

    public Booking approveBooking(Long id) {
        Booking b = repo.findById(id).get();
        b.setStatus("APPROVED");
        return repo.save(b);
    }
}