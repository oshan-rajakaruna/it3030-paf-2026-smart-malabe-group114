package com.smartcampus.repository;

import java.util.List;

import com.smartcampus.model.TicketComment;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface TicketCommentRepository extends MongoRepository<TicketComment, String> {

    List<TicketComment> findByTicketId(String ticketId);
}
