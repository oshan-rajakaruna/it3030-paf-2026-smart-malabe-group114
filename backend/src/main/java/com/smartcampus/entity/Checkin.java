package com.smartcampus.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "checkins")
public class Checkin {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String status;

    @OneToOne
    @JoinColumn(name = "booking_id")
    private Booking booking;
}