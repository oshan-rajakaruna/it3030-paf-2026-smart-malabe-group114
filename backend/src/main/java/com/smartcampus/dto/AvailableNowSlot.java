package com.smartcampus.dto;

import lombok.Data;

@Data
public class AvailableNowSlot {
    private String resourceId;
    private String resourceName;
    private String location;
    private String bookingDate;
    private String availableFrom;
    private String availableTo;
    private String type;
    private String badge;
}
