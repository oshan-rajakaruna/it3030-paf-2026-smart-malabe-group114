package com.smartcampus.service;

import com.smartcampus.dto.BookingScannerDetails;
import com.smartcampus.dto.CheckinResponse;
import com.smartcampus.dto.CheckinStats;
import com.smartcampus.dto.CheckedInBookingRow;
import com.smartcampus.model.Booking;
import com.smartcampus.model.BookingHistory;
import com.smartcampus.model.Checkin;
import com.smartcampus.model.Resource;
import com.smartcampus.model.rolemanagement.NotificationAudienceRole;
import com.smartcampus.model.rolemanagement.NotificationChannel;
import com.smartcampus.model.rolemanagement.NotificationModule;
import com.smartcampus.model.rolemanagement.NotificationPriority;
import com.smartcampus.model.rolemanagement.User;
import com.smartcampus.repository.BookingHistoryRepository;
import com.smartcampus.repository.BookingRepository;
import com.smartcampus.repository.CheckinRepository;
import com.smartcampus.repository.ResourceRepository;
import com.smartcampus.repository.rolemanagement.UserRepository;
import com.smartcampus.service.rolemanagement.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.NoSuchElementException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
public class BookingService {

    private static final Logger LOGGER = LoggerFactory.getLogger(BookingService.class);

    @Autowired
    private BookingRepository repo;

    @Autowired
    private BookingHistoryRepository bookingHistoryRepository;

    @Autowired
    private ResourceRepository resourceRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CheckinRepository checkinRepository;

    @Autowired
    private NotificationService notificationService;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMMM d, yyyy");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("hh:mm a");
    private static final DateTimeFormatter CHECKIN_TIME_FORMATTER = DateTimeFormatter.ofPattern("hh:mm a");
    private static final DateTimeFormatter SLOT_TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter CHECKIN_AT_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
    private static final long CANCELLATION_NOTICE_HOURS = 12;

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

        Booking saved = repo.save(booking);
        saveBookingHistory(saved, saved.getStatus());

        boolean urgentApproval = Boolean.TRUE.equals(saved.getUrgentApproval());

        try {
            notificationService.notifyRole(
                NotificationAudienceRole.ADMIN,
                urgentApproval ? "Urgent Booking Approval Needed" : "New Booking Request",
                urgentApproval
                    ? "A student requested a reopened no-show slot. Please review quickly because this time window is already running"
                        + (saved.getId() != null ? " (Booking " + saved.getId() + ")." : ".")
                    : "A new booking request was created" + (saved.getId() != null ? " (Booking " + saved.getId() + ")." : "."),
                NotificationModule.BOOKING,
                NotificationPriority.HIGH,
                NotificationChannel.WEB,
                saved.getUserId()
            );
        } catch (Exception notificationError) {
            LOGGER.warn("Booking created but admin notification failed for bookingId={}", saved.getId(), notificationError);
        }

        return saved;
    }

    public List<Booking> getAllBookings() {
        markNoShows();
        return repo.findAll();
    }

    public List<Booking> getFilteredBookings(
        String query,
        String status,
        String type,
        String capacity,
        String startDate,
        String endDate
    ) {
        markNoShows();

        String normalizedQuery = query == null ? "" : query.trim().toLowerCase();
        String normalizedStatus = status == null ? "ALL" : status.trim();
        String normalizedType = type == null ? "ALL" : type.trim();
        String normalizedCapacity = capacity == null ? "ALL" : capacity.trim();
        LocalDate parsedStartDate = parseDateOrNull(startDate);
        LocalDate parsedEndDate = parseDateOrNull(endDate);

        return repo.findAll().stream()
            .filter(booking -> matchesAdminFilters(
                booking,
                normalizedQuery,
                normalizedStatus,
                normalizedType,
                normalizedCapacity,
                parsedStartDate,
                parsedEndDate
            ))
            .toList();
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
        Booking booking = repo.findById(id).orElseThrow();
        validateCancellationWindow(booking);
        saveBookingHistory(booking, "DELETED");
        repo.deleteById(id);
    }

    public Booking updateBooking(String id, Booking incomingBooking) {
        Booking booking = repo.findById(id).orElseThrow();
        String previousStatus = booking.getStatus();
        boolean wasDateChangeApproved = Boolean.TRUE.equals(booking.getDateChangeApproved());

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

        // Date-change workflow status:
        // - request sent -> PENDING
        // - request approved -> APPROVED
        if (Boolean.TRUE.equals(booking.getDateChangeRequested())) {
            booking.setStatus("PENDING");
        } else if (Boolean.TRUE.equals(booking.getDateChangeApproved())) {
            booking.setStatus("APPROVED");
        } else if (incomingBooking.getStatus() != null && !incomingBooking.getStatus().isBlank()) {
            booking.setStatus(incomingBooking.getStatus());
        }

        booking.setUpdatedAt(LocalDateTime.now());

        Booking saved = repo.save(booking);
        if (hasStatusChanged(previousStatus, saved.getStatus())) {
            saveBookingHistory(saved, saved.getStatus());
        }

        boolean isDateChangeApprovedNow = Boolean.TRUE.equals(saved.getDateChangeApproved());
        if (!wasDateChangeApproved && isDateChangeApprovedNow) {
            notifyBookingUser(
                saved,
                "Date Change Approved",
                buildDateChangeApprovedMessage(saved),
                NotificationPriority.NORMAL,
                "ADMIN"
            );
        }

        return saved;
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
        validateResourceOperatingWindow(resource, startTime, endTime);

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

    private boolean matchesAdminFilters(
        Booking booking,
        String query,
        String status,
        String type,
        String capacity,
        LocalDate startDate,
        LocalDate endDate
    ) {
        Resource resource = booking.getResourceId() != null
            ? resourceRepository.findById(booking.getResourceId()).orElse(null)
            : null;
        User user = booking.getUserId() != null
            ? userRepository.findById(booking.getUserId()).orElse(null)
            : null;

        boolean matchesQuery = query.isBlank() || String.join(
            " ",
            safeLower(user != null ? user.getName() : booking.getUserId()),
            safeLower(booking.getUserId()),
            safeLower(resource != null ? resource.getName() : booking.getResourceId()),
            safeLower(booking.getDescription()),
            safeLower(booking.getStatus()),
            booking.getBookingDate() != null ? booking.getBookingDate().toString().toLowerCase() : ""
        ).contains(query);

        boolean matchesStatus = "ALL".equalsIgnoreCase(status) || status.equalsIgnoreCase(booking.getStatus());
        boolean matchesType = "ALL".equalsIgnoreCase(type) || type.equalsIgnoreCase(resource != null ? String.valueOf(resource.getType()) : null);
        boolean matchesCapacity = "ALL".equalsIgnoreCase(capacity)
            || capacity.equals(getCapacityLabel(resource != null ? resource.getCapacity() : null));
        boolean matchesStartDate = startDate == null || (booking.getBookingDate() != null && !booking.getBookingDate().isBefore(startDate));
        boolean matchesEndDate = endDate == null || (booking.getBookingDate() != null && !booking.getBookingDate().isAfter(endDate));

        return matchesQuery && matchesStatus && matchesType && matchesCapacity && matchesStartDate && matchesEndDate;
    }

    private String getCapacityLabel(Integer capacity) {
        if (capacity == null) {
            return "0";
        }
        if (capacity <= 20) return "1-20";
        if (capacity <= 50) return "21-50";
        if (capacity <= 120) return "51-120";
        return "120+";
    }

    private LocalDate parseDateOrNull(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }

        try {
            return LocalDate.parse(rawValue.trim());
        } catch (Exception ignored) {
            return null;
        }
    }

    private String safeLower(String value) {
        return value == null ? "" : value.toLowerCase();
    }

    private boolean overlaps(LocalTime startA, LocalTime endA, LocalTime startB, LocalTime endB) {
        return startA.isBefore(endB) && endA.isAfter(startB);
    }

    private void validateResourceAvailability(Resource resource) {
        if (Boolean.FALSE.equals(resource.getIsActive())) {
            throw new ResponseStatusException(
                BAD_REQUEST,
                resource.getName() + " is currently inactive and cannot be booked."
            );
        }

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

    private void validateResourceOperatingWindow(Resource resource, LocalTime startTime, LocalTime endTime) {
        LocalTime availableFrom = resource.getAvailableFrom();
        LocalTime availableTo = resource.getAvailableTo();

        if (availableFrom == null || availableTo == null) {
            return;
        }

        if (!endTime.isAfter(startTime)) {
            throw new ResponseStatusException(
                BAD_REQUEST,
                "Booking end time must be after start time."
            );
        }

        if (startTime.isBefore(availableFrom) || endTime.isAfter(availableTo)) {
            throw new ResponseStatusException(
                BAD_REQUEST,
                resource.getName() + " is available from " + availableFrom + " to " + availableTo + "."
            );
        }
    }

    public Booking approveBooking(String id) {
        Booking booking = repo.findById(id).orElseThrow();
        String previousStatus = booking.getStatus();
        booking.setStatus("APPROVED");
        booking.setUpdatedAt(LocalDateTime.now());
        Booking saved = repo.save(booking);
        if (hasStatusChanged(previousStatus, saved.getStatus())) {
            saveBookingHistory(saved, saved.getStatus());
        }

        if (saved.getUserId() != null && !saved.getUserId().isBlank()) {
            try {
                notificationService.notifyUser(
                    saved.getUserId(),
                    "Booking Approved",
                    "Your booking request has been approved.",
                    NotificationModule.BOOKING,
                    NotificationPriority.NORMAL,
                    NotificationChannel.WEB,
                    "ADMIN"
                );
            } catch (Exception notificationError) {
                LOGGER.warn("Booking approved but user notification failed for bookingId={}", saved.getId(), notificationError);
            }
        }

        return saved;
    }

    public Booking rejectBooking(String id, String reason) {
        Booking booking = repo.findById(id).orElseThrow();
        String previousStatus = booking.getStatus();
        booking.setStatus("REJECTED");
        booking.setRejectionReason(reason);
        booking.setUpdatedAt(LocalDateTime.now());
        Booking saved = repo.save(booking);
        if (hasStatusChanged(previousStatus, saved.getStatus())) {
            saveBookingHistory(saved, saved.getStatus());
        }

        String safeReason = (reason == null || reason.isBlank())
            ? "Rejected by admin."
            : reason.trim();
        notifyBookingUser(
            saved,
            "Booking Rejected",
            "Your booking request was rejected. Reason: " + safeReason,
            NotificationPriority.HIGH,
            "ADMIN"
        );

        return saved;
    }

    public Booking rejectDateChangeRequest(String id, String reason) {
        Booking booking = repo.findById(id).orElseThrow();
        String previousStatus = booking.getStatus();

        String safeReason = (reason == null || reason.isBlank())
            ? "Date change request rejected by admin."
            : reason.trim();

        booking.setDateChangeRequested(false);
        booking.setDateChangeApproved(false);
        booking.setRequestedDate(null);
        booking.setRequestedStartTime(null);
        booking.setRequestedEndTime(null);
        booking.setStatus("APPROVED");
        booking.setUpdatedAt(LocalDateTime.now());

        Booking saved = repo.save(booking);
        if (hasStatusChanged(previousStatus, saved.getStatus())) {
            saveBookingHistory(saved, saved.getStatus());
        }

        notifyBookingUser(
            saved,
            "Date Change Rejected",
            "Your date change request was rejected. Reason: " + safeReason,
            NotificationPriority.NORMAL,
            "ADMIN"
        );

        return saved;
    }

    public Booking cancelBooking(String id) {
        Booking booking = repo.findById(id).orElseThrow();
        String previousStatus = booking.getStatus();
        validateCancellationWindow(booking);
        booking.setStatus("CANCELLED");
        booking.setUpdatedAt(LocalDateTime.now());
        Booking saved = repo.save(booking);
        if (hasStatusChanged(previousStatus, saved.getStatus())) {
            saveBookingHistory(saved, saved.getStatus());
        }
        return saved;
    }

    public void markNoShows() {
        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.MINUTES);

        repo.findAll().stream()
            .filter(booking -> "APPROVED".equalsIgnoreCase(booking.getStatus()))
            .filter(booking -> !Boolean.TRUE.equals(booking.getCheckedIn()))
            .filter(booking -> booking.getBookingDate() != null && booking.getStartTime() != null)
            .filter(booking -> now.isAfter(getNoShowDeadline(booking)))
            .forEach(booking -> {
                String previousStatus = booking.getStatus();
                booking.setStatus("NO_SHOW");
                booking.setUpdatedAt(now);
                Booking saved = repo.save(booking);
                if (hasStatusChanged(previousStatus, saved.getStatus())) {
                    saveBookingHistory(saved, saved.getStatus());
                }
                notifyBookingUser(
                    saved,
                    "Booking Marked as No Show",
                    "Your booking was marked as NO_SHOW because check-in was not completed within 15 minutes of start time.",
                    NotificationPriority.NORMAL,
                    "SYSTEM"
                );
            });
    }

    private LocalDateTime getNoShowDeadline(Booking booking) {
        return LocalDateTime
            .of(booking.getBookingDate(), booking.getStartTime())
            .plusMinutes(15);
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

        LocalDateTime latestCheckinTime = getNoShowDeadline(booking);

        if (now.isAfter(latestCheckinTime)) {
            String previousStatus = booking.getStatus();
            booking.setStatus("NO_SHOW");
            booking.setCheckedIn(false);
            booking.setUpdatedAt(now);
            Booking saved = repo.save(booking);
            if (hasStatusChanged(previousStatus, saved.getStatus())) {
                saveBookingHistory(saved, saved.getStatus());
            }
            notifyBookingUser(
                saved,
                "Booking Marked as No Show",
                "Your booking was marked as NO_SHOW because check-in was not completed within 15 minutes of start time.",
                NotificationPriority.NORMAL,
                "SYSTEM"
            );

            response.setMessage("Check-in window closed \u274C You had until " + latestCheckinTime.format(CHECKIN_TIME_FORMATTER) + ".");
            response.setStartTime(booking.getStartTime() != null ? booking.getStartTime().format(SLOT_TIME_FORMATTER) : null);
            response.setEndTime(booking.getEndTime() != null ? booking.getEndTime().format(SLOT_TIME_FORMATTER) : null);
            return response;
        }

        String previousStatus = booking.getStatus();
        booking.setCheckedIn(true);
        booking.setCheckedInAt(now);
        booking.setStatus("CHECKED_IN");
        booking.setUpdatedAt(now);
        Booking saved = repo.save(booking);
        if (hasStatusChanged(previousStatus, saved.getStatus())) {
            saveBookingHistory(saved, saved.getStatus());
        }

        if (!checkinRepository.existsByBookingId(saved.getId())) {
            Checkin checkin = new Checkin();
            checkin.setBookingId(saved.getId());
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

    private boolean hasStatusChanged(String previousStatus, String nextStatus) {
        if (previousStatus == null) {
            return nextStatus != null;
        }

        return nextStatus == null || !previousStatus.equalsIgnoreCase(nextStatus);
    }

    private void saveBookingHistory(Booking booking, String status) {
        if (booking == null || booking.getId() == null || booking.getId().isBlank()) {
            return;
        }

        BookingHistory history = new BookingHistory();
        history.setBookingId(booking.getId());
        history.setUserId(booking.getUserId());
        history.setStatus(status);
        bookingHistoryRepository.save(history);
    }

    private void notifyBookingUser(
        Booking booking,
        String title,
        String message,
        NotificationPriority priority,
        String createdBy
    ) {
        if (booking.getUserId() == null || booking.getUserId().isBlank()) {
            return;
        }
        try {
            notificationService.notifyUser(
                booking.getUserId(),
                title,
                message,
                NotificationModule.BOOKING,
                priority,
                NotificationChannel.WEB,
                createdBy
            );
        } catch (Exception notificationError) {
            LOGGER.warn(
                "Booking state changed but user notification failed for bookingId={}",
                booking.getId(),
                notificationError
            );
        }
    }

    private String buildDateChangeApprovedMessage(Booking booking) {
        if (booking.getBookingDate() == null || booking.getStartTime() == null || booking.getEndTime() == null) {
            return "Your date change request has been approved.";
        }
        return "Your date change request has been approved. New slot: "
            + booking.getBookingDate().format(DATE_FORMATTER)
            + " "
            + booking.getStartTime().format(TIME_FORMATTER)
            + " - "
            + booking.getEndTime().format(TIME_FORMATTER)
            + ".";
    }

    private void validateCancellationWindow(Booking booking) {
        if (booking == null) {
            return;
        }

        String normalizedStatus = booking.getStatus() == null
            ? ""
            : booking.getStatus().trim().toUpperCase().replace("-", "_");

        if (
            "REJECTED".equals(normalizedStatus)
                || "CHECKED_IN".equals(normalizedStatus)
                || "NO_SHOW".equals(normalizedStatus)
        ) {
            return;
        }

        if (booking.getBookingDate() == null || booking.getStartTime() == null) {
            return;
        }

        LocalDateTime bookingStartTime = LocalDateTime.of(booking.getBookingDate(), booking.getStartTime());
        LocalDateTime cancellationDeadline = bookingStartTime.minusHours(CANCELLATION_NOTICE_HOURS);

        if (LocalDateTime.now().isAfter(cancellationDeadline)) {
            throw new ResponseStatusException(
                BAD_REQUEST,
                "Cannot cancel this booking. Cancellations must be made at least 12 hours before the booking start time."
            );
        }
    }
}
