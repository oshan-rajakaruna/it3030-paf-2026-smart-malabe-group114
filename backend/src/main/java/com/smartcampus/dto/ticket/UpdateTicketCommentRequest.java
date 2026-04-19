package com.smartcampus.dto.ticket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateTicketCommentRequest {

    private String userId;

    private String commentText;

    @Builder.Default
    private boolean admin = false;
}
