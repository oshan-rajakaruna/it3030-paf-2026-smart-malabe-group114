package com.smartcampus.repository;

import java.util.List;

import com.smartcampus.model.Ticket;
import com.smartcampus.model.enums.TicketCategory;
import com.smartcampus.model.enums.TicketPriority;
import com.smartcampus.model.enums.TicketStatus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TicketRepository extends JpaRepository<Ticket, Long> {

    List<Ticket> findByStatus(TicketStatus status);

    List<Ticket> findByPriority(TicketPriority priority);

    List<Ticket> findByCategory(TicketCategory category);

    List<Ticket> findByCreatedBy(String createdBy);

    List<Ticket> findByAssignedTechnician(String assignedTechnician);
}
