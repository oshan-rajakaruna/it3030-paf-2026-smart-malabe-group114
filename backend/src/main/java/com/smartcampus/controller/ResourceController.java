package com.smartcampus.controller;

import com.smartcampus.dto.CreateResourceRequestDto;
import com.smartcampus.dto.ResourceResponseDto;
import com.smartcampus.dto.UpdateResourceRequestDto;
import com.smartcampus.model.enums.ResourceStatus;
import com.smartcampus.model.enums.ResourceType;
import com.smartcampus.service.ResourceService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.NoSuchElementException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor
public class ResourceController {

    private final ResourceService resourceService;

    @PostMapping
    public ResponseEntity<ResourceResponseDto> createResource(@Valid @RequestBody CreateResourceRequestDto requestDto) {
        ResourceResponseDto createdResource = resourceService.createResource(requestDto);
        URI location = URI.create("/api/resources/" + createdResource.getId());

        return ResponseEntity.created(location).body(createdResource);
    }

    @GetMapping
    public ResponseEntity<List<ResourceResponseDto>> getAllResources(
        @RequestParam(required = false) ResourceType type,
        @RequestParam(required = false) String location,
        @RequestParam(required = false) ResourceStatus status,
        @RequestParam(required = false) Boolean isActive,
        @RequestParam(required = false) Integer minCapacity,
        @RequestParam(required = false) String search
    ) {
        return ResponseEntity.ok(resourceService.getAllResources(type, location, status, isActive, minCapacity, search));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResourceResponseDto> getResourceById(@PathVariable String id) {
        return ResponseEntity.ok(resourceService.getResourceById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResourceResponseDto> updateResource(
        @PathVariable String id,
        @Valid @RequestBody UpdateResourceRequestDto requestDto
    ) {
        return ResponseEntity.ok(resourceService.updateResource(id, requestDto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteResource(@PathVariable String id) {
        resourceService.deleteResource(id);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<String> handleNotFound(NoSuchElementException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(exception.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleBadRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(exception.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<String> handleConflict(IllegalStateException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(exception.getMessage());
    }
}
