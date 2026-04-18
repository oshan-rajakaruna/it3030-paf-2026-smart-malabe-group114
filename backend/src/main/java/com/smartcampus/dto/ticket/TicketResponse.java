package com.smartcampus.dto.ticket;

import java.time.LocalDateTime;

import com.smartcampus.model.enums.TicketCategory;
import com.smartcampus.model.enums.TicketPriority;
import com.smartcampus.model.enums.TicketStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketResponse {

    private String id;

    private String title;

    private String description;

    private String location;

    private TicketCategory category;

    private TicketPriority priority;

    private TicketStatus status;

    private String createdBy;

    private String preferredContact;

    private String assignedTechnician;

    private String resolutionNotes;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
