package com.smartcampus.model.rolemanagement;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Document(collection = "existing_ids")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExistingId {

  @Id
  private String id;

  @Indexed(unique = true)
  private String idNumber;
}



