package com.smartcampus.dto.ticket;

import com.smartcampus.model.enums.TicketStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateTicketStatusRequest {

    private TicketStatus status;

    private String updatedBy;

    private String updatedByRole;
}
