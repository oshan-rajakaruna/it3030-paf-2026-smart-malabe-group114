package com.smartcampus.repository;

import java.util.List;

import com.smartcampus.model.TicketAttachment;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface TicketAttachmentRepository extends MongoRepository<TicketAttachment, String> {

    List<TicketAttachment> findByTicketId(String ticketId);

    void deleteByTicketId(String ticketId);
}
