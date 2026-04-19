package com.smartcampus.dto.dashboard;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardRecentTicketItem {

    private String id;

    private String title;

    private String location;

    private String priority;

    private String status;

    private String reporterName;

    private String assignedTechnicianName;

    private LocalDateTime createdAt;
}
