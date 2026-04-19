package com.smartcampus.dto.ticket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssignTechnicianRequest {

    private String assignedTechnician;

    private String assignedBy;

    private String assignedByRole;
}
