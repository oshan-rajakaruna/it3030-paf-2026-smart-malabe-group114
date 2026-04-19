package com.smartcampus.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.smartcampus.dto.ticket.AddTicketCommentRequest;
import com.smartcampus.dto.ticket.AssignTechnicianRequest;
import com.smartcampus.dto.ticket.CreateTicketRequest;
import com.smartcampus.dto.ticket.TicketCommentResponse;
import com.smartcampus.dto.ticket.TicketResponse;
import com.smartcampus.dto.ticket.UpdateTicketCommentRequest;
import com.smartcampus.dto.ticket.UpdateResolutionRequest;
import com.smartcampus.dto.ticket.UpdateTicketStatusRequest;
import com.smartcampus.model.Ticket;
import com.smartcampus.model.TicketAttachment;
import com.smartcampus.model.TicketComment;
import com.smartcampus.model.enums.TicketStatus;
import com.smartcampus.repository.TicketAttachmentRepository;
import com.smartcampus.repository.TicketCommentRepository;
import com.smartcampus.repository.TicketRepository;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.stereotype.Service;

@Service
public class TicketService {

    private final TicketRepository ticketRepository;
    private final TicketAttachmentRepository ticketAttachmentRepository;
    private final TicketCommentRepository ticketCommentRepository;

    public TicketService(
        TicketRepository ticketRepository,
        TicketAttachmentRepository ticketAttachmentRepository,
        TicketCommentRepository ticketCommentRepository
    ) {
        this.ticketRepository = ticketRepository;
        this.ticketAttachmentRepository = ticketAttachmentRepository;
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
            .preferredContact(request.getPreferredContact())
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
        if (request.getStatus() == TicketStatus.REJECTED) {
            ticket.setRejectionReason(request.getRejectionReason());
        } else {
            ticket.setRejectionReason(null);
        }
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

        LocalDateTime now = LocalDateTime.now();
        TicketComment ticketComment = TicketComment.builder()
            .ticketId(ticketId)
            .userId(request.getUserId())
            .commentText(request.getCommentText())
            .createdAt(now)
            .updatedAt(now)
            .build();

        TicketComment savedComment = ticketCommentRepository.save(ticketComment);
        return mapToCommentResponse(savedComment);
    }

    public List<TicketCommentResponse> getCommentsByTicketId(String ticketId) {
        ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + ticketId));

        return ticketCommentRepository.findByTicketId(ticketId)
            .stream()
            .map(this::mapToCommentResponse)
            .toList();
    }

    public TicketCommentResponse updateComment(String ticketId, String commentId, UpdateTicketCommentRequest request) {
        ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + ticketId));

        TicketComment comment = ticketCommentRepository.findById(commentId)
            .orElseThrow(() -> new RuntimeException("Comment not found with id: " + commentId));

        if (!ticketId.equals(comment.getTicketId())) {
            throw new RuntimeException("Comment does not belong to the selected ticket.");
        }

        validateCommentOwnership(comment, request.getUserId(), request.isAdmin());

        comment.setCommentText(request.getCommentText());
        comment.setUpdatedAt(LocalDateTime.now());

        TicketComment updatedComment = ticketCommentRepository.save(comment);
        return mapToCommentResponse(updatedComment);
    }

    public void deleteComment(String ticketId, String commentId, String userId, boolean admin) {
        ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + ticketId));

        TicketComment comment = ticketCommentRepository.findById(commentId)
            .orElseThrow(() -> new RuntimeException("Comment not found with id: " + commentId));

        if (!ticketId.equals(comment.getTicketId())) {
            throw new RuntimeException("Comment does not belong to the selected ticket.");
        }

        validateCommentOwnership(comment, userId, admin);
        ticketCommentRepository.delete(comment);
    }

    public TicketAttachment uploadAttachment(String ticketId, MultipartFile file) {
        ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + ticketId));

        if (file.isEmpty()) {
            throw new RuntimeException("File is empty");
        }

        Path uploadDirectory = Paths.get("uploads");

        try {
            Files.createDirectories(uploadDirectory);

            String originalFileName = file.getOriginalFilename();
            if (originalFileName == null || originalFileName.isBlank()) {
                originalFileName = "file";
            } else {
                originalFileName = Paths.get(originalFileName).getFileName().toString();
            }

            String uniqueFileName = UUID.randomUUID() + "_" + originalFileName;
            Path filePath = uploadDirectory.resolve(uniqueFileName);

            Files.copy(file.getInputStream(), filePath);

            TicketAttachment ticketAttachment = TicketAttachment.builder()
                .ticketId(ticketId)
                .fileName(uniqueFileName)
                .filePath(filePath.toString())
                .uploadedAt(LocalDateTime.now())
                .build();

            return ticketAttachmentRepository.save(ticketAttachment);
        } catch (IOException e) {
            throw new RuntimeException("Failed to upload file", e);
        }
    }

    public List<TicketAttachment> getAttachmentsByTicketId(String ticketId) {
        ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + ticketId));

        return ticketAttachmentRepository.findByTicketId(ticketId);
    }

    public void deleteTicket(String ticketId) {
        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + ticketId));

        List<TicketAttachment> attachments = ticketAttachmentRepository.findByTicketId(ticketId);
        attachments.forEach((attachment) -> {
            String rawFilePath = attachment.getFilePath();
            if (rawFilePath == null || rawFilePath.isBlank()) {
                return;
            }

            try {
                Files.deleteIfExists(Paths.get(rawFilePath));
            } catch (IOException ignored) {
                // Preserve ticket deletion even if a local file was already removed manually.
            }
        });

        ticketAttachmentRepository.deleteByTicketId(ticketId);
        ticketCommentRepository.deleteByTicketId(ticketId);
        ticketRepository.delete(ticket);
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
            .preferredContact(ticket.getPreferredContact())
            .assignedTechnician(ticket.getAssignedTechnician())
            .resolutionNotes(ticket.getResolutionNotes())
            .rejectionReason(ticket.getRejectionReason())
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
            .updatedAt(ticketComment.getUpdatedAt())
            .build();
    }

    private void validateCommentOwnership(TicketComment comment, String userId, boolean admin) {
        if (admin) {
            return;
        }

        if (userId == null || userId.isBlank() || !userId.equals(comment.getUserId())) {
            throw new RuntimeException("You can only edit or delete your own comments.");
        }
    }
}
