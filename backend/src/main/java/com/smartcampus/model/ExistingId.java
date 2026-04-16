package com.smartcampus.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "existing_ids")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExistingId {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "id_number", nullable = false, unique = true, length = 80)
  private String idNumber;

  @PrePersist
  void normalize() {
    if (idNumber != null) {
      idNumber = idNumber.trim().toUpperCase();
    }
  }
}
