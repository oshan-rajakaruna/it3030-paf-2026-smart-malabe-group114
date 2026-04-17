package com.smartcampus.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.smartcampus.model.enums.ResourceStatus;
import com.smartcampus.model.enums.ResourceType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateResourceRequestDto {

    @JsonProperty("resourceCode")
    @NotBlank(message = "Resource code is required")
    @Size(max = 50, message = "Resource code must not exceed 50 characters")
    private String resourceCode;

    @JsonProperty("name")
    @NotBlank(message = "Name is required")
    @Size(max = 150, message = "Name must not exceed 150 characters")
    private String name;

    @JsonProperty("type")
    @NotNull(message = "Resource type is required")
    private ResourceType type;

    @JsonProperty("location")
    @NotBlank(message = "Location is required")
    @Size(max = 120, message = "Location must not exceed 120 characters")
    private String location;

    @JsonProperty("floor")
    @Size(max = 50, message = "Floor must not exceed 50 characters")
    private String floor;

    @JsonProperty("capacity")
    @NotNull(message = "Capacity is required")
    @Min(value = 0, message = "Capacity must be 0 or greater")
    private Integer capacity;

    @JsonProperty("status")
    @NotNull(message = "Resource status is required")
    private ResourceStatus status;

    @JsonProperty("isActive")
    @NotNull(message = "Active status is required")
    private Boolean isActive;

    @JsonProperty("description")
    @Size(max = 1000, message = "Description must not exceed 1000 characters")
    private String description;

    @JsonProperty("imageUrl")
    @Size(max = 500, message = "Image URL must not exceed 500 characters")
    private String imageUrl;

    @JsonProperty("availableFrom")
    @JsonFormat(pattern = "HH:mm:ss")
    @NotNull(message = "Available from time is required")
    private LocalTime availableFrom;

    @JsonProperty("availableTo")
    @JsonFormat(pattern = "HH:mm:ss")
    @NotNull(message = "Available to time is required")
    private LocalTime availableTo;
}
