package com.smartcampus.service;

import com.smartcampus.dto.CreateResourceRequestDto;
import com.smartcampus.dto.ResourceResponseDto;
import com.smartcampus.dto.UpdateResourceRequestDto;
import com.smartcampus.model.Resource;
import com.smartcampus.model.enums.ResourceStatus;
import com.smartcampus.model.enums.ResourceType;
import com.smartcampus.repository.ResourceRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import com.smartcampus.dto.AvailableNowSlot;
import com.smartcampus.model.Booking;
import com.smartcampus.repository.BookingRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;

@Service
@RequiredArgsConstructor
public class ResourceService {

    private final ResourceRepository resourceRepository;

    private final BookingRepository bookingRepository;
    private final BookingService bookingService;

    private static final LocalTime DAY_END = LocalTime.of(19, 0);
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

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
        if (Boolean.FALSE.equals(resource.getIsActive())) {
            continue;
        }

        if (resource.getStatus() != null && !"AVAILABLE".equalsIgnoreCase(resource.getStatus().name())) {
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


    public ResourceResponseDto createResource(CreateResourceRequestDto requestDto) {
        validateCapacity(requestDto.getCapacity());
        validateUniqueResourceCode(requestDto.getResourceCode(), null);

        Resource resource = new Resource();
        applyResourceFields(
            resource,
            requestDto.getResourceCode(),
            requestDto.getName(),
            requestDto.getType(),
            requestDto.getLocation(),
            requestDto.getFloor(),
            requestDto.getCapacity(),
            requestDto.getStatus(),
            requestDto.getIsActive(),
            requestDto.getDescription(),
            requestDto.getImageUrl(),
            requestDto.getAvailableFrom(),
            requestDto.getAvailableTo()
        );
        LocalDateTime now = LocalDateTime.now();
        resource.setCreatedAt(now);
        resource.setUpdatedAt(now);
        Resource savedResource = resourceRepository.save(resource);
        return mapToResponseDto(savedResource);
    }

    public List<ResourceResponseDto> getAllResources(
        ResourceType type,
        String location,
        ResourceStatus status,
        Integer minCapacity,
        String search
    ) {
        validateCapacity(minCapacity);

        return resourceRepository.findAll()
            .stream()
            .filter(resource -> matchesFilters(resource, type, location, status, minCapacity, search))
            .map(this::mapToResponseDto)
            .toList();
    }

    public ResourceResponseDto getResourceById(String id) {
        return mapToResponseDto(findResourceById(id));
    }

    public ResourceResponseDto updateResource(String id, UpdateResourceRequestDto requestDto) {
        validateCapacity(requestDto.getCapacity());

        Resource existingResource = findResourceById(id);
        validateUniqueResourceCode(requestDto.getResourceCode(), existingResource.getId());

        applyResourceFields(
            existingResource,
            requestDto.getResourceCode(),
            requestDto.getName(),
            requestDto.getType(),
            requestDto.getLocation(),
            requestDto.getFloor(),
            requestDto.getCapacity(),
            requestDto.getStatus(),
            requestDto.getIsActive(),
            requestDto.getDescription(),
            requestDto.getImageUrl(),
            requestDto.getAvailableFrom(),
            requestDto.getAvailableTo()
        );
        existingResource.setUpdatedAt(LocalDateTime.now());

        Resource savedResource = resourceRepository.save(existingResource);
        return mapToResponseDto(savedResource);
    }

    public void deleteResource(String id) {
        Resource resource = findResourceById(id);
        resourceRepository.delete(resource);
    }

    private void validateCapacity(Integer capacity) {
        if (capacity != null && capacity < 0) {
            throw new IllegalArgumentException("Capacity cannot be negative");
        }
    }

    private void validateUniqueResourceCode(String resourceCode, String currentResourceId) {
        resourceRepository.findByResourceCode(resourceCode)
            .ifPresent(existingResource -> {
                if (currentResourceId == null || !existingResource.getId().equals(currentResourceId)) {
                    throw new IllegalStateException("Resource code already exists: " + resourceCode);
                }
            });
    }

    private Resource findResourceById(String id) {
        return resourceRepository.findById(id)
            .orElseThrow(() -> new NoSuchElementException("Resource not found with id: " + id));
    }

    private boolean matchesFilters(
        Resource resource,
        ResourceType type,
        String location,
        ResourceStatus status,
        Integer minCapacity,
        String search
    ) {
        boolean matchesType = type == null || resource.getType() == type;
        boolean matchesLocation = location == null || location.isBlank()
            || safeValue(resource.getLocation()).toLowerCase().contains(location.toLowerCase());
        boolean matchesStatus = status == null || resource.getStatus() == status;
        boolean matchesCapacity = minCapacity == null
            || (resource.getCapacity() != null && resource.getCapacity() >= minCapacity);
        boolean matchesSearch = search == null || search.isBlank()
            || buildSearchableText(resource).contains(search.toLowerCase());

        return matchesType && matchesLocation && matchesStatus && matchesCapacity && matchesSearch;
    }

    private String buildSearchableText(Resource resource) {
        return String.join(
            " ",
            safeValue(resource.getResourceCode()),
            safeValue(resource.getName())
        ).toLowerCase();
    }

    private String safeValue(String value) {
        return value == null ? "" : value;
    }

    private void applyResourceFields(
        Resource resource,
        String resourceCode,
        String name,
        ResourceType type,
        String location,
        String floor,
        Integer capacity,
        ResourceStatus status,
        Boolean isActive,
        String description,
        String imageUrl,
        java.time.LocalTime availableFrom,
        java.time.LocalTime availableTo
    ) {
        resource.setResourceCode(resourceCode);
        resource.setName(name);
        resource.setType(type);
        resource.setLocation(location);
        resource.setFloor(floor);
        resource.setCapacity(capacity);
        resource.setStatus(status);
        resource.setIsActive(isActive);
        resource.setDescription(description);
        resource.setImageUrl(imageUrl);
        resource.setAvailableFrom(availableFrom);
        resource.setAvailableTo(availableTo);
    }

    private ResourceResponseDto mapToResponseDto(Resource resource) {
        return ResourceResponseDto.builder()
            .id(resource.getId())
            .resourceCode(resource.getResourceCode())
            .name(resource.getName())
            .type(resource.getType())
            .location(resource.getLocation())
            .floor(resource.getFloor())
            .capacity(resource.getCapacity())
            .status(resource.getStatus())
            .isActive(resource.getIsActive())
            .description(resource.getDescription())
            .imageUrl(resource.getImageUrl())
            .availableFrom(resource.getAvailableFrom())
            .availableTo(resource.getAvailableTo())
            .createdAt(resource.getCreatedAt())
            .updatedAt(resource.getUpdatedAt())
            .build();
    }
}
