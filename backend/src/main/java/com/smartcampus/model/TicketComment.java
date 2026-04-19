package com.smartcampus.model;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "ticket_comments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketComment {

    @Id
    private String id;

    private String ticketId;

    private String userId;

    private String commentText;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
