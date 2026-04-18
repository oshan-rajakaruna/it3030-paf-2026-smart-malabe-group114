package com.smartcampus.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@Document(collection = "bookings")
public class Booking {

    @Id
    private String id;

    private String userId;
    private String resourceId;

    // 🔥 consistent naming
    private LocalDate bookingDate;
    private LocalTime startTime;
    private LocalTime endTime;

    private String description;
    private Integer attendeesCount;

    private String status;
    private Boolean urgentApproval;
    private String rejectionReason;
    private Boolean checkedIn;
    private LocalDateTime checkedInAt;
    private Boolean dateChangeRequested;
    private Boolean dateChangeApproved;
    private LocalDate requestedDate;
    private LocalTime requestedStartTime;
    private LocalTime requestedEndTime;
    private LocalDate previousDate;
    private LocalTime previousStartTime;
    private LocalTime previousEndTime;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
