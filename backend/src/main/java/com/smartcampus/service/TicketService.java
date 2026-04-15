package com.smartcampus.service;

import java.util.List;

import com.smartcampus.dto.ticket.CreateTicketRequest;
import com.smartcampus.dto.ticket.TicketResponse;
import com.smartcampus.model.Ticket;
import com.smartcampus.model.enums.TicketStatus;
import com.smartcampus.repository.TicketRepository;

public class TicketService {

    private final TicketRepository ticketRepository;

    public TicketService(TicketRepository ticketRepository) {
        this.ticketRepository = ticketRepository;
    }

    public TicketResponse createTicket(CreateTicketRequest request) {
        Ticket ticket = Ticket.builder()
            .title(request.getTitle())
            .description(request.getDescription())
            .location(request.getLocation())
            .category(request.getCategory())
            .priority(request.getPriority())
            .status(TicketStatus.OPEN)
            .createdBy(request.getCreatedBy())
            .build();

        Ticket savedTicket = ticketRepository.save(ticket);
        return mapToResponse(savedTicket);
    }

    public List<TicketResponse> getAllTickets() {
        return ticketRepository.findAll()
            .stream()
            .map(this::mapToResponse)
            .toList();
    }

    public TicketResponse getTicketById(Long id) {
        Ticket ticket = ticketRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + id));

        return mapToResponse(ticket);
    }

    private TicketResponse mapToResponse(Ticket ticket) {
        return TicketResponse.builder()
            .id(ticket.getId())
            .title(ticket.getTitle())
            .description(ticket.getDescription())
            .location(ticket.getLocation())
            .category(ticket.getCategory())
            .priority(ticket.getPriority())
            .status(ticket.getStatus())
            .createdBy(ticket.getCreatedBy())
            .assignedTechnician(ticket.getAssignedTechnician())
            .resolutionNotes(ticket.getResolutionNotes())
            .createdAt(ticket.getCreatedAt())
            .updatedAt(ticket.getUpdatedAt())
            .build();
    }
}
