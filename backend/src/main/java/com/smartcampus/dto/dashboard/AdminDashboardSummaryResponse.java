package com.smartcampus.dto.dashboard;

import java.util.List;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminDashboardSummaryResponse {

    private long totalResources;

    private long activeResources;

    private long totalBookings;

    private long pendingBookings;

    private long totalTickets;

    private long openAndInProgressTickets;

    private Map<String, Long> resourcesByType;

    private Map<String, Long> resourcesByStatus;

    private Map<String, Long> bookingsByStatus;

    private Map<String, Long> ticketsByStatus;

    private List<DashboardRecentBookingItem> recentBookings;

    private List<DashboardRecentTicketItem> recentTickets;

    private List<DashboardRecentResourceItem> recentResources;
}
