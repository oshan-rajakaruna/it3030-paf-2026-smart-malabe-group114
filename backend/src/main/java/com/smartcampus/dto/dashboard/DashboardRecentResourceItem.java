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
public class DashboardRecentResourceItem {

    private String id;

    private String resourceCode;

    private String name;

    private String type;

    private String location;

    private String status;

    private Boolean isActive;

    private LocalDateTime createdAt;
}
