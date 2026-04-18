package com.smartcampus.dto;

import lombok.Data;

@Data
public class CheckinResponse {
    private String message;
    private String checkedInAt;
    private String startTime;
    private String endTime;
    private boolean late;
}
