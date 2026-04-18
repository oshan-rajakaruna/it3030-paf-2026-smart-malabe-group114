package com.smartcampus.dto.ticket;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketCommentResponse {

    private String id;

    private String ticketId;

    private String userId;

    private String commentText;

    private LocalDateTime createdAt;
}
