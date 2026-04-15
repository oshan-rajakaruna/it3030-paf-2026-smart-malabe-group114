package com.smartcampus.dto.ticket;

import com.smartcampus.model.enums.TicketCategory;
import com.smartcampus.model.enums.TicketPriority;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateTicketRequest {

    private String title;

    private String description;

    private String location;

    private TicketCategory category;

    private TicketPriority priority;

    private String createdBy;
}
