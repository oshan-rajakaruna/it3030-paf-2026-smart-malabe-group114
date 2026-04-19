package com.smartcampus.dto;

import lombok.Data;

@Data
public class CheckedInBookingRow {
    private String id;
    private String user;
    private String resource;
    private String bookingDate;
    private String startTime;
    private String endTime;
    private String checkedInAt;
    private String status;
    private boolean late;
}
