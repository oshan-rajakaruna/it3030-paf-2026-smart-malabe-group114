package com.smartcampus.service;

import java.time.LocalDateTime;
import java.util.List;

import com.smartcampus.dto.ticket.AddTicketCommentRequest;
import com.smartcampus.dto.ticket.AssignTechnicianRequest;
import com.smartcampus.dto.ticket.CreateTicketRequest;
import com.smartcampus.dto.ticket.TicketCommentResponse;
import com.smartcampus.dto.ticket.TicketResponse;
import com.smartcampus.dto.ticket.UpdateResolutionRequest;
import com.smartcampus.dto.ticket.UpdateTicketStatusRequest;
import com.smartcampus.model.Ticket;
import com.smartcampus.model.TicketComment;
import com.smartcampus.model.enums.TicketStatus;
import com.smartcampus.repository.TicketCommentRepository;
import com.smartcampus.repository.TicketRepository;
import org.springframework.stereotype.Service;

@Service
public class TicketService {

    private final TicketRepository ticketRepository;
    private final TicketCommentRepository ticketCommentRepository;

    public TicketService(TicketRepository ticketRepository, TicketCommentRepository ticketCommentRepository) {
        this.ticketRepository = ticketRepository;
        this.ticketCommentRepository = ticketCommentRepository;
    }

    public TicketResponse createTicket(CreateTicketRequest request) {
        LocalDateTime now = LocalDateTime.now();
        Ticket ticket = Ticket.builder()
            .title(request.getTitle())
            .description(request.getDescription())
            .location(request.getLocation())
            .category(request.getCategory())
            .priority(request.getPriority())
            .status(TicketStatus.OPEN)
            .createdBy(request.getCreatedBy())
            .createdAt(now)
            .updatedAt(now)
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

    public TicketResponse getTicketById(String id) {
        Ticket ticket = ticketRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + id));

        return mapToResponse(ticket);
    }

    public TicketResponse updateTicketStatus(String id, UpdateTicketStatusRequest request) {
        Ticket ticket = ticketRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + id));

        ticket.setStatus(request.getStatus());
        ticket.setUpdatedAt(LocalDateTime.now());

        Ticket updatedTicket = ticketRepository.save(ticket);
        return mapToResponse(updatedTicket);
    }

    public TicketResponse assignTechnician(String id, AssignTechnicianRequest request) {
        Ticket ticket = ticketRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + id));

        ticket.setAssignedTechnician(request.getAssignedTechnician());
        ticket.setUpdatedAt(LocalDateTime.now());

        Ticket updatedTicket = ticketRepository.save(ticket);
        return mapToResponse(updatedTicket);
    }

    public TicketResponse updateResolutionNotes(String id, UpdateResolutionRequest request) {
        Ticket ticket = ticketRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + id));

        ticket.setResolutionNotes(request.getResolutionNotes());
        ticket.setUpdatedAt(LocalDateTime.now());

        Ticket updatedTicket = ticketRepository.save(ticket);
        return mapToResponse(updatedTicket);
    }

    public TicketCommentResponse addComment(String ticketId, AddTicketCommentRequest request) {
        ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + ticketId));

        TicketComment ticketComment = TicketComment.builder()
            .ticketId(ticketId)
            .userId(request.getUserId())
            .commentText(request.getCommentText())
            .createdAt(LocalDateTime.now())
            .build();

        TicketComment savedComment = ticketCommentRepository.save(ticketComment);
        return mapToCommentResponse(savedComment);
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

    private TicketCommentResponse mapToCommentResponse(TicketComment ticketComment) {
        return TicketCommentResponse.builder()
            .id(ticketComment.getId())
            .ticketId(ticketComment.getTicketId())
            .userId(ticketComment.getUserId())
            .commentText(ticketComment.getCommentText())
            .createdAt(ticketComment.getCreatedAt())
            .build();
    }
}
