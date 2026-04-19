package com.smartcampus.dto.dashboard;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardRecentBookingItem {

    private String id;

    private String requesterName;

    private String resourceName;

    private LocalDate bookingDate;

    private LocalTime startTime;

    private LocalTime endTime;

    private String status;

    private LocalDateTime createdAt;
}
