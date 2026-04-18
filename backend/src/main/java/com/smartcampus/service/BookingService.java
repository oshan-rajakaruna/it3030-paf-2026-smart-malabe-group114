package com.smartcampus.service;

import com.smartcampus.dto.BookingScannerDetails;
import com.smartcampus.dto.CheckinResponse;
import com.smartcampus.dto.CheckinStats;
import com.smartcampus.dto.CheckedInBookingRow;
import com.smartcampus.entity.Booking;
import com.smartcampus.entity.Checkin;
import com.smartcampus.entity.Resource;
import com.smartcampus.entity.User;
import com.smartcampus.repository.BookingRepository;
import com.smartcampus.repository.CheckinRepository;
import com.smartcampus.repository.ResourceRepository;
import com.smartcampus.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.NoSuchElementException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
public class BookingService {

    @Autowired
    private BookingRepository repo;

    @Autowired
    private ResourceRepository resourceRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CheckinRepository checkinRepository;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMMM d, yyyy");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("hh:mm a");
    private static final DateTimeFormatter CHECKIN_TIME_FORMATTER = DateTimeFormatter.ofPattern("hh:mm a");
    private static final DateTimeFormatter SLOT_TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter CHECKIN_AT_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    public Booking createBooking(Booking booking) {
        LocalDateTime now = LocalDateTime.now();

        validateBookingWindow(
            booking.getResourceId(),
            booking.getAttendeesCount(),
            booking.getBookingDate(),
            booking.getStartTime(),
            booking.getEndTime(),
            null
        );

        if (booking.getStatus() == null || booking.getStatus().isBlank()) {
            booking.setStatus("PENDING");
        }
        if (booking.getUrgentApproval() == null) {
            booking.setUrgentApproval(false);
        }
        if (booking.getDateChangeRequested() == null) {
            booking.setDateChangeRequested(false);
        }
        if (booking.getDateChangeApproved() == null) {
            booking.setDateChangeApproved(false);
        }
        if (booking.getCheckedIn() == null) {
            booking.setCheckedIn(false);
        }
        booking.setCheckedInAt(null);

        booking.setCreatedAt(now);
        booking.setUpdatedAt(now);

        return repo.save(booking);
    }

    public List<Booking> getAllBookings() {
        markNoShows();
        return repo.findAll();
    }

    public BookingScannerDetails getScannerDetails(String id) {
        markNoShows();
        Booking booking = repo.findById(id).orElseThrow(NoSuchElementException::new);
        Resource resource = resourceRepository.findById(booking.getResourceId()).orElse(null);
        User user = userRepository.findById(booking.getUserId()).orElse(null);

        BookingScannerDetails details = new BookingScannerDetails();
        details.setId(booking.getId());
        details.setResource(resource != null ? resource.getName() : "Resource " + booking.getResourceId());
        details.setDate(booking.getBookingDate() != null ? booking.getBookingDate().format(DATE_FORMATTER) : "Unknown date");
        details.setTime(
            booking.getStartTime() != null && booking.getEndTime() != null
                ? booking.getStartTime().format(TIME_FORMATTER) + " - " + booking.getEndTime().format(TIME_FORMATTER)
                : "Unknown time"
        );
        details.setStartTime(booking.getStartTime() != null ? booking.getStartTime().format(SLOT_TIME_FORMATTER) : null);
        details.setEndTime(booking.getEndTime() != null ? booking.getEndTime().format(SLOT_TIME_FORMATTER) : null);
        details.setCheckedInAt(booking.getCheckedInAt() != null ? booking.getCheckedInAt().format(CHECKIN_AT_FORMATTER) : null);
        details.setLocation(resource != null ? resource.getLocation() : "Campus resource hub");
        details.setStudent(user != null ? user.getName() : booking.getUserId());
        details.setStatus(booking.getStatus());
        details.setValid("APPROVED".equalsIgnoreCase(booking.getStatus()));
        return details;
    }

    public List<CheckedInBookingRow> getCheckedInBookings() {
        markNoShows();
        return repo.findAll().stream()
            .filter(booking -> Boolean.TRUE.equals(booking.getCheckedIn()) && booking.getCheckedInAt() != null)
            .sorted((left, right) -> right.getCheckedInAt().compareTo(left.getCheckedInAt()))
            .map(booking -> {
                Resource resource = resourceRepository.findById(booking.getResourceId()).orElse(null);
                User user = userRepository.findById(booking.getUserId()).orElse(null);

                CheckedInBookingRow row = new CheckedInBookingRow();
                row.setId(booking.getId());
                row.setUser(user != null ? user.getName() : booking.getUserId());
                row.setResource(resource != null ? resource.getName() : "Resource " + booking.getResourceId());
                row.setBookingDate(booking.getBookingDate() != null ? booking.getBookingDate().toString() : null);
                row.setStartTime(booking.getStartTime() != null ? booking.getStartTime().format(SLOT_TIME_FORMATTER) : null);
                row.setEndTime(booking.getEndTime() != null ? booking.getEndTime().format(SLOT_TIME_FORMATTER) : null);
                row.setCheckedInAt(booking.getCheckedInAt().format(CHECKIN_AT_FORMATTER));
                row.setStatus("CHECKED-IN");
                row.setLate(isLateCheckin(booking.getCheckedInAt(), booking.getStartTime()));
                return row;
            })
            .toList();
    }

    public CheckinStats getCheckinStats() {
        long validCheckins = repo.findAll().stream()
            .filter(booking -> Boolean.TRUE.equals(booking.getCheckedIn()))
            .count();
        return new CheckinStats(validCheckins, validCheckins, 0);
    }

    public void deleteBooking(String id) {
        repo.deleteById(id);
    }

    public Booking updateBooking(String id, Booking incomingBooking) {
        Booking booking = repo.findById(id).orElseThrow();

        validateBookingWindow(
            incomingBooking.getResourceId(),
            incomingBooking.getAttendeesCount(),
            incomingBooking.getBookingDate(),
            incomingBooking.getStartTime(),
            incomingBooking.getEndTime(),
            id
        );

        booking.setResourceId(incomingBooking.getResourceId());
        booking.setBookingDate(incomingBooking.getBookingDate());
        booking.setStartTime(incomingBooking.getStartTime());
        booking.setEndTime(incomingBooking.getEndTime());
        booking.setDescription(incomingBooking.getDescription());
        booking.setAttendeesCount(incomingBooking.getAttendeesCount());
        if (incomingBooking.getStatus() != null && !incomingBooking.getStatus().isBlank()) {
            booking.setStatus(incomingBooking.getStatus());
        }
        booking.setUrgentApproval(incomingBooking.getUrgentApproval() != null ? incomingBooking.getUrgentApproval() : booking.getUrgentApproval());
        booking.setCheckedIn(incomingBooking.getCheckedIn() != null ? incomingBooking.getCheckedIn() : booking.getCheckedIn());
        booking.setCheckedInAt(incomingBooking.getCheckedInAt() != null ? incomingBooking.getCheckedInAt() : booking.getCheckedInAt());
        booking.setRejectionReason(incomingBooking.getRejectionReason());
        booking.setDateChangeRequested(Boolean.TRUE.equals(incomingBooking.getDateChangeRequested()));
        booking.setDateChangeApproved(Boolean.TRUE.equals(incomingBooking.getDateChangeApproved()));
        booking.setRequestedDate(incomingBooking.getRequestedDate());
        booking.setRequestedStartTime(incomingBooking.getRequestedStartTime());
        booking.setRequestedEndTime(incomingBooking.getRequestedEndTime());
        booking.setPreviousDate(incomingBooking.getPreviousDate());
        booking.setPreviousStartTime(incomingBooking.getPreviousStartTime());
        booking.setPreviousEndTime(incomingBooking.getPreviousEndTime());
        booking.setUpdatedAt(LocalDateTime.now());

        return repo.save(booking);
    }

    private void validateBookingWindow(
        String resourceId,
        Integer attendeesCount,
        java.time.LocalDate bookingDate,
        LocalTime startTime,
        LocalTime endTime,
        String excludedBookingId
    ) {
        if (resourceId == null || resourceId.isBlank() || attendeesCount == null || bookingDate == null || startTime == null || endTime == null) {
            return;
        }

        Resource resource = resourceRepository.findById(resourceId).orElseThrow(
            () -> new ResponseStatusException(BAD_REQUEST, "Selected resource was not found.")
        );

        validateResourceAvailability(resource);

        Integer capacity = resource.getCapacity();
        if (capacity != null && attendeesCount > capacity) {
            throw new ResponseStatusException(
                BAD_REQUEST,
                isEquipmentResource(resource)
                    ? "Only " + capacity + " units available for " + resource.getName() + "."
                    : "Only " + capacity + " attendees allowed for " + resource.getName() + "."
            );
        }

        List<Booking> overlappingBookings = repo.findAll().stream()
            .filter(booking -> excludedBookingId == null || !excludedBookingId.equals(booking.getId()))
            .filter(booking -> resourceId.equals(booking.getResourceId()))
            .filter(booking -> bookingDate.equals(booking.getBookingDate()))
            .filter(booking -> !isInactiveStatus(booking.getStatus()))
            .filter(booking -> overlaps(startTime, endTime, booking.getStartTime(), booking.getEndTime()))
            .toList();

        if (isEquipmentResource(resource)) {
            int reservedUnits = overlappingBookings.stream()
                .map(booking -> booking.getAttendeesCount() == null ? 0 : booking.getAttendeesCount())
                .reduce(0, Integer::sum);
            int availableUnits = Math.max(0, (capacity == null ? 0 : capacity) - reservedUnits);

            if (capacity != null && attendeesCount > availableUnits) {
                throw new ResponseStatusException(
                    BAD_REQUEST,
                    "Only " + availableUnits + " units still available for " + resource.getName() + " in that time window."
                );
            }

            return;
        }

        if (!overlappingBookings.isEmpty()) {
            throw new ResponseStatusException(
                BAD_REQUEST,
                resource.getName() + " is already booked for that time window."
            );
        }
    }

    private boolean isEquipmentResource(Resource resource) {
        return resource.getType() != null && "EQUIPMENT".equalsIgnoreCase(resource.getType().trim());
    }

    private boolean isInactiveStatus(String status) {
        return "REJECTED".equalsIgnoreCase(status)
            || "CANCELLED".equalsIgnoreCase(status)
            || "NO_SHOW".equalsIgnoreCase(status);
    }

    private boolean overlaps(LocalTime startA, LocalTime endA, LocalTime startB, LocalTime endB) {
        return startA.isBefore(endB) && endA.isAfter(startB);
    }

    private void validateResourceAvailability(Resource resource) {
        String status = resource.getStatus() == null ? "" : resource.getStatus().trim().toUpperCase();
        if (status.isBlank() || "AVAILABLE".equals(status)) {
            return;
        }

        if ("MAINTENANCE".equals(status)) {
            throw new ResponseStatusException(
                BAD_REQUEST,
                resource.getName() + " is currently under maintenance and cannot be booked."
            );
        }

        if ("UNAVAILABLE".equals(status)) {
            throw new ResponseStatusException(
                BAD_REQUEST,
                resource.getName() + " is currently unavailable and cannot be booked."
            );
        }

        throw new ResponseStatusException(
            BAD_REQUEST,
            resource.getName() + " is not available for booking right now."
        );
    }

    public Booking approveBooking(String id) {
        Booking booking = repo.findById(id).orElseThrow();
        booking.setStatus("APPROVED");
        booking.setUpdatedAt(LocalDateTime.now());
        return repo.save(booking);
    }

    public Booking rejectBooking(String id, String reason) {
        Booking booking = repo.findById(id).orElseThrow();
        booking.setStatus("REJECTED");
        booking.setRejectionReason(reason);
        booking.setUpdatedAt(LocalDateTime.now());
        return repo.save(booking);
    }

    public Booking cancelBooking(String id) {
        Booking booking = repo.findById(id).orElseThrow();
        booking.setStatus("CANCELLED");
        booking.setUpdatedAt(LocalDateTime.now());
        return repo.save(booking);
    }

    public void markNoShows() {
        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.MINUTES);

        repo.findAll().stream()
            .filter(booking -> "APPROVED".equalsIgnoreCase(booking.getStatus()))
            .filter(booking -> !Boolean.TRUE.equals(booking.getCheckedIn()))
            .filter(booking -> booking.getBookingDate() != null && booking.getStartTime() != null)
            .filter(booking -> !now.isBefore(LocalDateTime.of(booking.getBookingDate(), booking.getStartTime()).plusMinutes(15)))
            .forEach(booking -> {
                booking.setStatus("NO_SHOW");
                booking.setUpdatedAt(now);
                repo.save(booking);
            });
    }

    public CheckinResponse checkinBooking(String bookingId) {
        markNoShows();
        CheckinResponse response = new CheckinResponse();
        Booking booking = repo.findById(bookingId).orElse(null);
        if (booking == null) {
            response.setMessage("Invalid QR \u274C");
            return response;
        }

        if (!"APPROVED".equalsIgnoreCase(booking.getStatus())) {
            response.setMessage("Booking not approved \u274C");
            return response;
        }

        if (Boolean.TRUE.equals(booking.getCheckedIn())) {
            response.setMessage("Already checked in \u274C");
            response.setCheckedInAt(booking.getCheckedInAt() != null ? booking.getCheckedInAt().format(CHECKIN_AT_FORMATTER) : null);
            response.setStartTime(booking.getStartTime() != null ? booking.getStartTime().format(SLOT_TIME_FORMATTER) : null);
            response.setEndTime(booking.getEndTime() != null ? booking.getEndTime().format(SLOT_TIME_FORMATTER) : null);
            response.setLate(isLateCheckin(booking.getCheckedInAt(), booking.getStartTime()));
            return response;
        }

        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        LocalDateTime bookingStart = LocalDateTime.of(booking.getBookingDate(), booking.getStartTime());
        LocalDateTime bookingEnd = LocalDateTime.of(booking.getBookingDate(), booking.getEndTime());

        LocalDateTime earliestCheckinTime = bookingStart.minusMinutes(15);

        if (now.isBefore(earliestCheckinTime)) {
            response.setMessage("Too early \u274C Come at " + earliestCheckinTime.format(CHECKIN_TIME_FORMATTER) + ".");
            response.setStartTime(booking.getStartTime() != null ? booking.getStartTime().format(SLOT_TIME_FORMATTER) : null);
            response.setEndTime(booking.getEndTime() != null ? booking.getEndTime().format(SLOT_TIME_FORMATTER) : null);
            return response;
        }

        LocalDateTime latestCheckinTime = bookingStart.plusMinutes(15);

        if (now.isAfter(latestCheckinTime)) {
            response.setMessage("Check-in window closed \u274C You had until " + latestCheckinTime.format(CHECKIN_TIME_FORMATTER) + ".");
            response.setStartTime(booking.getStartTime() != null ? booking.getStartTime().format(SLOT_TIME_FORMATTER) : null);
            response.setEndTime(booking.getEndTime() != null ? booking.getEndTime().format(SLOT_TIME_FORMATTER) : null);
            return response;
        }

        booking.setCheckedIn(true);
        booking.setCheckedInAt(now);
        booking.setStatus("CHECKED_IN");
        booking.setUpdatedAt(now);
        repo.save(booking);

        if (!checkinRepository.existsByBookingId(booking.getId())) {
            Checkin checkin = new Checkin();
            checkin.setBookingId(booking.getId());
            checkin.setStatus("CHECKED_IN");
            checkinRepository.save(checkin);
        }

        response.setMessage("Check-in successful");
        response.setCheckedInAt(now.format(CHECKIN_AT_FORMATTER));
        response.setStartTime(booking.getStartTime() != null ? booking.getStartTime().format(SLOT_TIME_FORMATTER) : null);
        response.setEndTime(booking.getEndTime() != null ? booking.getEndTime().format(SLOT_TIME_FORMATTER) : null);
        response.setLate(isLateCheckin(now, booking.getStartTime()));
        return response;
    }

    private boolean isLateCheckin(LocalDateTime checkedInAt, LocalTime bookingStartTime) {
        if (checkedInAt == null || bookingStartTime == null) {
            return false;
        }

        LocalTime checkedInMinute = checkedInAt.toLocalTime().truncatedTo(ChronoUnit.MINUTES);
        LocalTime bookingStartMinute = bookingStartTime.truncatedTo(ChronoUnit.MINUTES);

        return checkedInMinute.isAfter(bookingStartMinute);
    }
}
