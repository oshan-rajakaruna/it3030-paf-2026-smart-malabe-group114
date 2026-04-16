package com.smartcampus.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "resources")
public class Resource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String type;
    private String location;
    private Integer capacity;
    private String status;
    private String description;
}
