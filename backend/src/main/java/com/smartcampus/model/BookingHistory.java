package com.smartcampus.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document(collection = "booking_history")
public class BookingHistory {

    @Id
    private String id;

    private String status;
    private String bookingId;
    private String userId;
}
