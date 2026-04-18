package com.smartcampus.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document(collection = "checkins")
public class Checkin {

    @Id
    private String id;

    private String status;
    private String bookingId;
}
