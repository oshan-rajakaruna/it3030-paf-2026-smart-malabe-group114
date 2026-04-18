package com.smartcampus.controller;

import com.smartcampus.dto.BookingScannerDetails;
import com.smartcampus.dto.CheckinResponse;
import com.smartcampus.dto.CheckinStats;
import com.smartcampus.dto.CheckedInBookingRow;
import com.smartcampus.model.Booking;
import com.smartcampus.service.BookingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.List;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/bookings")
@CrossOrigin(origins = "*")
public class BookingController {

    @Autowired
    private BookingService service;

    @PostMapping
    public Booking create(@RequestBody Booking booking) {
        return service.createBooking(booking);
    }

    @GetMapping
    public List<Booking> getAll() {
        return service.getAllBookings();
    }

    @GetMapping("/filter")
    public List<Booking> getFiltered(
        @RequestParam(required = false) String query,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String capacity,
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate
    ) {
        return service.getFilteredBookings(query, status, type, capacity, startDate, endDate);
    }

    @GetMapping("/{id}/scanner-details")
    public BookingScannerDetails scannerDetails(@PathVariable String id) {
        try {
            return service.getScannerDetails(id);
        } catch (NoSuchElementException error) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found.");
        }
    }

    @GetMapping("/checkin-stats")
    public CheckinStats checkinStats() {
        return service.getCheckinStats();
    }

    @GetMapping("/checked-in")
    public List<CheckedInBookingRow> checkedInBookings() {
        return service.getCheckedInBookings();
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        service.deleteBooking(id);
    }

    @PutMapping("/{id}")
    public Booking update(@PathVariable String id, @RequestBody Booking booking) {
        return service.updateBooking(id, booking);
    }

    @PutMapping("/{id}/approve")
    public Booking approve(@PathVariable String id) {
        return service.approveBooking(id);
    }

    @PutMapping("/{id}/reject")
    public Booking reject(@PathVariable String id, @RequestBody Map<String, String> payload) {
        return service.rejectBooking(id, payload.getOrDefault("reason", "Rejected by admin."));
    }

    @PutMapping("/{id}/cancel")
    public Booking cancel(@PathVariable String id) {
        return service.cancelBooking(id);
    }

    @PostMapping("/checkin/{id}")
    public CheckinResponse checkin(@PathVariable String id) {
        return service.checkinBooking(id);
    }
}
