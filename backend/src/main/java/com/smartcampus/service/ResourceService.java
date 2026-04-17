package com.smartcampus.service;

import com.smartcampus.dto.CreateResourceRequestDto;
import com.smartcampus.dto.ResourceResponseDto;
import com.smartcampus.model.Resource;
import com.smartcampus.repository.ResourceRepository;
import java.util.List;
import java.util.NoSuchElementException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ResourceService {

    private final ResourceRepository resourceRepository;

    @Transactional
    public ResourceResponseDto createResource(CreateResourceRequestDto requestDto) {
        validateCapacity(requestDto.getCapacity());

        if (resourceRepository.existsByResourceCode(requestDto.getResourceCode())) {
            throw new IllegalStateException("Resource code already exists: " + requestDto.getResourceCode());
        }

        Resource resource = Resource.builder()
            .resourceCode(requestDto.getResourceCode())
            .name(requestDto.getName())
            .type(requestDto.getType())
            .location(requestDto.getLocation())
            .floor(requestDto.getFloor())
            .capacity(requestDto.getCapacity())
            .status(requestDto.getStatus())
            .isActive(requestDto.getIsActive())
            .description(requestDto.getDescription())
            .imageUrl(requestDto.getImageUrl())
            .availableFrom(requestDto.getAvailableFrom())
            .availableTo(requestDto.getAvailableTo())
            .build();

        Resource savedResource = resourceRepository.save(resource);
        return mapToResponseDto(savedResource);
    }

    public List<ResourceResponseDto> getAllResources() {
        return resourceRepository.findAll()
            .stream()
            .map(this::mapToResponseDto)
            .toList();
    }

    public ResourceResponseDto getResourceById(Long id) {
        Resource resource = resourceRepository.findById(id)
            .orElseThrow(() -> new NoSuchElementException("Resource not found with id: " + id));

        return mapToResponseDto(resource);
    }

    private void validateCapacity(Integer capacity) {
        if (capacity != null && capacity < 0) {
            throw new IllegalArgumentException("Capacity cannot be negative");
        }
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
