package com.smartcampus.model;

import com.smartcampus.model.enums.ResourceStatus;
import com.smartcampus.model.enums.ResourceType;
import java.time.LocalDateTime;
import java.time.LocalTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "resources")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Resource {

    @Id
    private String id;

    private String resourceCode;

    private String name;

    private ResourceType type;

    private String location;

    private String floor;

    private Integer capacity;

    private ResourceStatus status;

    private Boolean isActive;

    private String description;

    private String imageUrl;

    private LocalTime availableFrom;

    private LocalTime availableTo;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
