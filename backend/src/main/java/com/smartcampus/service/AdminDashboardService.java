package com.smartcampus.service;

import com.smartcampus.dto.dashboard.AdminDashboardSummaryResponse;
import com.smartcampus.dto.dashboard.DashboardRecentBookingItem;
import com.smartcampus.dto.dashboard.DashboardRecentResourceItem;
import com.smartcampus.dto.dashboard.DashboardRecentTicketItem;
import com.smartcampus.model.Booking;
import com.smartcampus.model.Resource;
import com.smartcampus.model.Ticket;
import com.smartcampus.model.enums.TicketStatus;
import com.smartcampus.model.rolemanagement.User;
import com.smartcampus.repository.BookingRepository;
import com.smartcampus.repository.ResourceRepository;
import com.smartcampus.repository.TicketRepository;
import com.smartcampus.repository.rolemanagement.UserRepository;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import org.springframework.stereotype.Service;

@Service
public class AdminDashboardService {

    private static final int RECENT_ITEMS_LIMIT = 5;

    private final ResourceRepository resourceRepository;
    private final BookingRepository bookingRepository;
    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final BookingService bookingService;

    public AdminDashboardService(
        ResourceRepository resourceRepository,
        BookingRepository bookingRepository,
        TicketRepository ticketRepository,
        UserRepository userRepository,
        BookingService bookingService
    ) {
        this.resourceRepository = resourceRepository;
        this.bookingRepository = bookingRepository;
        this.ticketRepository = ticketRepository;
        this.userRepository = userRepository;
        this.bookingService = bookingService;
    }

    public AdminDashboardSummaryResponse getSummary() {
        bookingService.markNoShows();

        List<Resource> resources = resourceRepository.findAll();
        List<Booking> bookings = bookingRepository.findAll();
        List<Ticket> tickets = ticketRepository.findAll();
        List<User> users = userRepository.findAll();

        Map<String, String> userDisplayLookup = buildUserDisplayLookup(users);
        Map<String, String> resourceNameLookup = buildResourceNameLookup(resources);

        return AdminDashboardSummaryResponse.builder()
            .totalResources(resources.size())
            .activeResources(resources.stream().filter(resource -> Boolean.TRUE.equals(resource.getIsActive())).count())
            .totalBookings(bookings.size())
            .pendingBookings(bookings.stream().filter(booking -> "PENDING".equalsIgnoreCase(booking.getStatus())).count())
            .totalTickets(tickets.size())
            .openAndInProgressTickets(
                tickets.stream()
                    .filter(ticket -> ticket.getStatus() == TicketStatus.OPEN || ticket.getStatus() == TicketStatus.IN_PROGRESS)
                    .count()
            )
            .resourcesByType(countBy(
                resources,
                resource -> normalizeValue(resource.getType(), "UNSPECIFIED"),
                List.of("ROOM", "LAB", "EQUIPMENT")
            ))
            .resourcesByStatus(countBy(
                resources,
                resource -> normalizeValue(resource.getStatus(), "UNSPECIFIED"),
                List.of("AVAILABLE", "UNAVAILABLE", "MAINTENANCE")
            ))
            .bookingsByStatus(countBy(
                bookings,
                booking -> normalizeValue(booking.getStatus(), "UNKNOWN"),
                List.of("PENDING", "APPROVED", "REJECTED", "CANCELLED", "CHECKED_IN", "NO_SHOW")
            ))
            .ticketsByStatus(countBy(
                tickets,
                ticket -> normalizeValue(ticket.getStatus(), "UNKNOWN"),
                List.of("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED")
            ))
            .recentBookings(buildRecentBookings(bookings, userDisplayLookup, resourceNameLookup))
            .recentTickets(buildRecentTickets(tickets, userDisplayLookup))
            .recentResources(buildRecentResources(resources))
            .build();
    }

    private List<DashboardRecentBookingItem> buildRecentBookings(
        List<Booking> bookings,
        Map<String, String> userDisplayLookup,
        Map<String, String> resourceNameLookup
    ) {
        return bookings.stream()
            .sorted(Comparator.comparing(this::resolveBookingRecency).reversed())
            .limit(RECENT_ITEMS_LIMIT)
            .map(booking -> DashboardRecentBookingItem.builder()
                .id(booking.getId())
                .requesterName(resolveDisplayName(booking.getUserId(), userDisplayLookup, "Unknown user"))
                .resourceName(resolveDisplayName(booking.getResourceId(), resourceNameLookup, "Campus resource"))
                .bookingDate(booking.getBookingDate())
                .startTime(booking.getStartTime())
                .endTime(booking.getEndTime())
                .status(normalizeValue(booking.getStatus(), "UNKNOWN"))
                .createdAt(resolveBookingRecency(booking))
                .build())
            .toList();
    }

    private List<DashboardRecentTicketItem> buildRecentTickets(List<Ticket> tickets, Map<String, String> userDisplayLookup) {
        return tickets.stream()
            .sorted(Comparator.comparing(this::resolveTicketRecency).reversed())
            .limit(RECENT_ITEMS_LIMIT)
            .map(ticket -> DashboardRecentTicketItem.builder()
                .id(ticket.getId())
                .title(ticket.getTitle())
                .location(ticket.getLocation())
                .priority(normalizeValue(ticket.getPriority(), "UNKNOWN"))
                .status(normalizeValue(ticket.getStatus(), "UNKNOWN"))
                .reporterName(resolveDisplayName(ticket.getCreatedBy(), userDisplayLookup, "Unknown user"))
                .assignedTechnicianName(resolveDisplayName(ticket.getAssignedTechnician(), userDisplayLookup, "Unassigned"))
                .createdAt(resolveTicketRecency(ticket))
                .build())
            .toList();
    }

    private List<DashboardRecentResourceItem> buildRecentResources(List<Resource> resources) {
        return resources.stream()
            .sorted(Comparator.comparing(this::resolveResourceRecency).reversed())
            .limit(RECENT_ITEMS_LIMIT)
            .map(resource -> DashboardRecentResourceItem.builder()
                .id(resource.getId())
                .resourceCode(resource.getResourceCode())
                .name(resource.getName())
                .type(normalizeValue(resource.getType(), "UNSPECIFIED"))
                .location(resource.getLocation())
                .status(normalizeValue(resource.getStatus(), "UNSPECIFIED"))
                .isActive(resource.getIsActive())
                .createdAt(resolveResourceRecency(resource))
                .build())
            .toList();
    }

    private Map<String, String> buildUserDisplayLookup(List<User> users) {
        Map<String, String> lookup = new LinkedHashMap<>();

        users.forEach(user -> {
            String displayName = buildUserDisplayName(user);
            putLookupValue(lookup, user.getId(), displayName);
            putLookupValue(lookup, user.getEmail(), displayName);
            putLookupValue(lookup, user.getIdNumber(), displayName);
        });

        return lookup;
    }

    private Map<String, String> buildResourceNameLookup(List<Resource> resources) {
        Map<String, String> lookup = new LinkedHashMap<>();

        resources.forEach(resource -> {
            String displayName = resource.getName() == null || resource.getName().isBlank()
                ? resource.getResourceCode()
                : resource.getName();
            putLookupValue(lookup, resource.getId(), displayName);
            putLookupValue(lookup, resource.getResourceCode(), displayName);
        });

        return lookup;
    }

    private void putLookupValue(Map<String, String> lookup, String key, String value) {
        if (key == null || key.isBlank() || value == null || value.isBlank()) {
            return;
        }
        lookup.putIfAbsent(key.trim(), value.trim());
    }

    private String buildUserDisplayName(User user) {
        if (user == null) {
            return "Unknown user";
        }
        if (user.getName() != null && !user.getName().isBlank()) {
            return user.getName().trim();
        }
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            return user.getEmail().trim();
        }
        return user.getId();
    }

    private String resolveDisplayName(String value, Map<String, String> lookup, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return lookup.getOrDefault(value.trim(), value.trim());
    }

    private <T> Map<String, Long> countBy(List<T> items, Function<T, String> valueExtractor, List<String> preferredOrder) {
        Map<String, Long> counts = new LinkedHashMap<>();
        preferredOrder.forEach(key -> counts.put(key, 0L));

        items.stream()
            .map(valueExtractor)
            .forEach(key -> counts.put(key, counts.getOrDefault(key, 0L) + 1L));

        Map<String, Long> orderedCounts = new LinkedHashMap<>();
        preferredOrder.forEach(key -> orderedCounts.put(key, counts.getOrDefault(key, 0L)));

        counts.entrySet().stream()
            .filter(entry -> !orderedCounts.containsKey(entry.getKey()))
            .sorted(Map.Entry.comparingByKey())
            .forEach(entry -> orderedCounts.put(entry.getKey(), entry.getValue()));

        return orderedCounts;
    }

    private String normalizeValue(Object value, String fallback) {
        if (value == null) {
            return fallback;
        }

        String normalized = String.valueOf(value).trim().toUpperCase(Locale.ROOT);
        return normalized.isEmpty() ? fallback : normalized;
    }

    private LocalDateTime resolveBookingRecency(Booking booking) {
        if (booking.getCreatedAt() != null) {
            return booking.getCreatedAt();
        }
        if (booking.getUpdatedAt() != null) {
            return booking.getUpdatedAt();
        }
        if (booking.getBookingDate() != null && booking.getStartTime() != null) {
            return LocalDateTime.of(booking.getBookingDate(), booking.getStartTime());
        }
        if (booking.getBookingDate() != null) {
            return booking.getBookingDate().atStartOfDay();
        }
        return LocalDateTime.MIN;
    }

    private LocalDateTime resolveTicketRecency(Ticket ticket) {
        if (ticket.getCreatedAt() != null) {
            return ticket.getCreatedAt();
        }
        if (ticket.getUpdatedAt() != null) {
            return ticket.getUpdatedAt();
        }
        return LocalDateTime.MIN;
    }

    private LocalDateTime resolveResourceRecency(Resource resource) {
        if (resource.getCreatedAt() != null) {
            return resource.getCreatedAt();
        }
        if (resource.getUpdatedAt() != null) {
            return resource.getUpdatedAt();
        }
        return LocalDateTime.MIN;
    }
}
