package com.smartcampus.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.smartcampus.model.enums.ResourceStatus;
import com.smartcampus.model.enums.ResourceType;
import java.time.LocalDateTime;
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
public class ResourceResponseDto {

    private String id;

    @JsonProperty("resourceCode")
    private String resourceCode;

    private String name;
    private ResourceType type;
    private String location;
    private String floor;
    private Integer capacity;
    private ResourceStatus status;

    @JsonProperty("isActive")
    private Boolean isActive;

    private String description;

    @JsonProperty("imageUrl")
    private String imageUrl;

    @JsonProperty("availableFrom")
    @JsonFormat(pattern = "HH:mm:ss")
    private LocalTime availableFrom;

    @JsonProperty("availableTo")
    @JsonFormat(pattern = "HH:mm:ss")
    private LocalTime availableTo;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
