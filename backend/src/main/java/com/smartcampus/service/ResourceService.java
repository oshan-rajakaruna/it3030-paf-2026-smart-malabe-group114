package com.smartcampus.service;

import com.smartcampus.dto.AvailableNowSlot;
import com.smartcampus.model.Booking;
import com.smartcampus.model.Resource;
import com.smartcampus.repository.BookingRepository;
import com.smartcampus.repository.ResourceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class ResourceService {

    @Autowired
    private ResourceRepository resourceRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private BookingService bookingService;

    private static final LocalTime DAY_END = LocalTime.of(19, 0);
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    public List<Resource> getAllResources() {
        return resourceRepository.findAll();
    }

    public List<AvailableNowSlot> getAvailableNowSlots() {
        bookingService.markNoShows();

        LocalDateTime now = LocalDateTime.now().withSecond(0).withNano(0);
        LocalDate today = now.toLocalDate();
        LocalTime currentTime = now.toLocalTime();

        List<Booking> todayBookings = bookingRepository.findAll().stream()
            .filter(booking -> today.equals(booking.getBookingDate()))
            .toList();

        List<AvailableNowSlot> slots = new ArrayList<>();

        for (Resource resource : resourceRepository.findAll()) {
            if (!"AVAILABLE".equalsIgnoreCase(String.valueOf(resource.getStatus()))) {
                continue;
            }

            List<Booking> resourceBookings = todayBookings.stream()
                .filter(booking -> resource.getId().equals(booking.getResourceId()))
                .sorted(Comparator.comparing(Booking::getStartTime))
                .toList();

            List<Booking> noShowBookings = resourceBookings.stream()
                .filter(booking -> "NO_SHOW".equalsIgnoreCase(booking.getStatus()))
                .filter(booking -> booking.getEndTime() != null && booking.getEndTime().isAfter(currentTime))
                .toList();

            if (!noShowBookings.isEmpty()) {
                boolean resourceHasReleasedSlot = false;

                for (Booking booking : noShowBookings) {
                    boolean currentlyRebooked = resourceBookings.stream().anyMatch(activeBooking ->
                        isActiveBooking(activeBooking)
                            && activeBooking.getStartTime() != null
                            && activeBooking.getEndTime() != null
                            && !activeBooking.getStartTime().isAfter(currentTime)
                            && activeBooking.getEndTime().isAfter(currentTime)
                    );

                    if (currentlyRebooked) {
                        continue;
                    }

                    LocalTime nextBusyStart = resourceBookings.stream()
                        .filter(this::isActiveBooking)
                        .map(Booking::getStartTime)
                        .filter(startTime -> startTime != null && startTime.isAfter(currentTime))
                        .min(LocalTime::compareTo)
                        .orElse(booking.getEndTime());

                    LocalTime releasedSlotEnd = nextBusyStart.isBefore(booking.getEndTime())
                        ? nextBusyStart
                        : booking.getEndTime();

                    if (!releasedSlotEnd.isAfter(currentTime)) {
                        continue;
                    }

                    AvailableNowSlot slot = new AvailableNowSlot();
                    slot.setResourceId(resource.getId());
                    slot.setResourceName(resource.getName());
                    slot.setLocation(resource.getLocation());
                    slot.setBookingDate(today.toString());
                    slot.setAvailableFrom(currentTime.format(TIME_FORMATTER));
                    slot.setAvailableTo(releasedSlotEnd.format(TIME_FORMATTER));
                    slot.setType("PARTIAL_SLOT");
                    slot.setBadge("RELEASED (NO_SHOW)");
                    slots.add(slot);
                    resourceHasReleasedSlot = true;
                }

                if (resourceHasReleasedSlot) {
                    continue;
                }
            }

            boolean currentlyOccupied = resourceBookings.stream().anyMatch(booking ->
                isActiveBooking(booking)
                    && booking.getStartTime() != null
                    && booking.getEndTime() != null
                    && !booking.getStartTime().isAfter(currentTime)
                    && booking.getEndTime().isAfter(currentTime)
            );

            if (currentlyOccupied) {
                continue;
            }

            LocalTime nextBusyStart = resourceBookings.stream()
                .filter(this::isActiveBooking)
                .map(Booking::getStartTime)
                .filter(startTime -> startTime != null && startTime.isAfter(currentTime))
                .min(LocalTime::compareTo)
                .orElse(DAY_END);

            if (!nextBusyStart.isAfter(currentTime)) {
                continue;
            }

            AvailableNowSlot slot = new AvailableNowSlot();
            slot.setResourceId(resource.getId());
            slot.setResourceName(resource.getName());
            slot.setLocation(resource.getLocation());
            slot.setBookingDate(today.toString());
            slot.setAvailableFrom(currentTime.format(TIME_FORMATTER));
            slot.setAvailableTo(nextBusyStart.format(TIME_FORMATTER));
            slot.setType("FULL_RESOURCE");
            slot.setBadge("AVAILABLE NOW");
            slots.add(slot);
        }

        slots.sort(Comparator.comparing(AvailableNowSlot::getAvailableFrom));
        return slots;
    }

    private boolean isActiveBooking(Booking booking) {
        return "PENDING".equalsIgnoreCase(booking.getStatus())
            || "APPROVED".equalsIgnoreCase(booking.getStatus())
            || "CHECKED_IN".equalsIgnoreCase(booking.getStatus());
    }
}
