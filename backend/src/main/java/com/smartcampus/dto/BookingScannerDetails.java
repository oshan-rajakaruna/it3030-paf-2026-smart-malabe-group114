package com.smartcampus.dto;

import lombok.Data;

@Data
public class BookingScannerDetails {
    private String id;
    private String resource;
    private String date;
    private String time;
    private String startTime;
    private String endTime;
    private String checkedInAt;
    private String location;
    private String student;
    private String status;
    private boolean valid;
}
