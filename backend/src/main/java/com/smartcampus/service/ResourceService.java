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

@Service
@RequiredArgsConstructor
public class ResourceService {

    private final ResourceRepository resourceRepository;

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
