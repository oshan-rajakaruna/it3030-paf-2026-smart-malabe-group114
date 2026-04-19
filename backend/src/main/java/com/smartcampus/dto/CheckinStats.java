package com.smartcampus.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class CheckinStats {
    private long total;
    private long valid;
    private long invalid;
}
