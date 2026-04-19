package com.smartcampus.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
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
import com.smartcampus.model.rolemanagement.NotificationAudienceRole;
import com.smartcampus.model.rolemanagement.NotificationChannel;
import com.smartcampus.model.rolemanagement.NotificationModule;
import com.smartcampus.model.rolemanagement.NotificationPriority;
import com.smartcampus.model.rolemanagement.User;
import com.smartcampus.model.rolemanagement.UserRole;
import com.smartcampus.model.enums.TicketStatus;
import com.smartcampus.repository.TicketAttachmentRepository;
import com.smartcampus.repository.TicketCommentRepository;
import com.smartcampus.repository.TicketRepository;
import com.smartcampus.repository.rolemanagement.UserRepository;
import com.smartcampus.service.rolemanagement.NotificationService;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class TicketService {

    private static final Logger LOGGER = LoggerFactory.getLogger(TicketService.class);

    private final TicketRepository ticketRepository;
    private final TicketAttachmentRepository ticketAttachmentRepository;
    private final TicketCommentRepository ticketCommentRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public TicketService(
        TicketRepository ticketRepository,
        TicketAttachmentRepository ticketAttachmentRepository,
        TicketCommentRepository ticketCommentRepository,
        UserRepository userRepository,
        NotificationService notificationService
    ) {
        this.ticketRepository = ticketRepository;
        this.ticketAttachmentRepository = ticketAttachmentRepository;
        this.ticketCommentRepository = ticketCommentRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    public TicketResponse createTicket(CreateTicketRequest request) {
        LocalDateTime now = LocalDateTime.now();
        String creatorId = resolveUserId(request.getCreatedBy());
        Ticket ticket = Ticket.builder()
            .title(request.getTitle())
            .description(request.getDescription())
            .location(request.getLocation())
            .category(request.getCategory())
            .priority(request.getPriority())
            .status(TicketStatus.OPEN)
            .createdBy(creatorId)
            .preferredContact(request.getPreferredContact())
            .createdAt(now)
            .updatedAt(now)
            .build();

        Ticket savedTicket = ticketRepository.save(ticket);

        try {
            notificationService.notifyRole(
                NotificationAudienceRole.ADMIN,
                "New Ticket Created",
                "A user created a new support ticket: " + savedTicket.getTitle(),
                NotificationModule.TICKET,
                NotificationPriority.HIGH,
                NotificationChannel.WEB,
                creatorId
            );
        } catch (Exception notificationError) {
            LOGGER.warn("Ticket created but admin notification failed for ticketId={}", savedTicket.getId(), notificationError);
        }

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

        String updaterId = resolveUserId(request.getUpdatedBy());
        UserRole updaterRole = resolveRoleForActor(updaterId, request.getUpdatedByRole(), ticket);
        TicketStatus previousStatus = ticket.getStatus();

        ticket.setStatus(request.getStatus());
        if (request.getStatus() == TicketStatus.REJECTED) {
            ticket.setRejectionReason(request.getRejectionReason());
        } else {
            ticket.setRejectionReason(null);
        }
        ticket.setUpdatedAt(LocalDateTime.now());

        Ticket updatedTicket = ticketRepository.save(ticket);

        boolean changed = previousStatus != request.getStatus();
        if (changed
            && (updaterRole == UserRole.ADMIN || updaterRole == UserRole.TECHNICIAN)
            && updatedTicket.getCreatedBy() != null
            && !updatedTicket.getCreatedBy().isBlank()) {
            String actorDisplay = updaterRole == UserRole.TECHNICIAN
                ? "Technician"
                : updaterRole == UserRole.ADMIN
                    ? "Admin"
                    : "System";
            String statusLabel = request.getStatus() == null ? "UPDATED" : request.getStatus().name();

            sendUserTicketNotification(
                updatedTicket.getCreatedBy(),
                "Ticket Status Updated",
                actorDisplay + " updated your ticket status to " + statusLabel + ": " + updatedTicket.getTitle(),
                updaterId
            );
        }

        return mapToResponse(updatedTicket);
    }

    public TicketResponse assignTechnician(String id, AssignTechnicianRequest request) {
        Ticket ticket = ticketRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + id));

        String assignedTechnicianId = resolveUserId(request.getAssignedTechnician());
        String assignedBy = resolveUserId(request.getAssignedBy());
        UserRole assignedByRole = resolveRoleForActor(assignedBy, request.getAssignedByRole(), ticket);

        ticket.setAssignedTechnician(assignedTechnicianId);
        ticket.setUpdatedAt(LocalDateTime.now());

        Ticket updatedTicket = ticketRepository.save(ticket);

        if (assignedByRole == UserRole.ADMIN && assignedTechnicianId != null && !assignedTechnicianId.isBlank()) {
            sendUserTicketNotification(
                assignedTechnicianId,
                "Ticket Assigned",
                "A ticket has been assigned to you: " + updatedTicket.getTitle(),
                assignedBy
            );
        }

        if (assignedByRole == UserRole.ADMIN
            && updatedTicket.getCreatedBy() != null
            && !updatedTicket.getCreatedBy().isBlank()
            && assignedTechnicianId != null
            && !assignedTechnicianId.isBlank()) {
            String technicianName = findUserDisplayName(assignedTechnicianId);
            sendUserTicketNotification(
                updatedTicket.getCreatedBy(),
                "Technician Assigned",
                "Admin assigned " + technicianName + " to your ticket: " + updatedTicket.getTitle(),
                assignedBy
            );
        }

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
        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found with id: " + ticketId));

        String commenterId = resolveUserId(request.getUserId());
        UserRole commenterRole = resolveRoleForActor(commenterId, request.getUserRole(), ticket);

        LocalDateTime now = LocalDateTime.now();
        TicketComment ticketComment = TicketComment.builder()
            .ticketId(ticketId)
            .userId(commenterId)
            .commentText(request.getCommentText())
            .createdAt(now)
            .updatedAt(now)
            .build();

        TicketComment savedComment = ticketCommentRepository.save(ticketComment);
        dispatchCommentNotifications(ticket, savedComment, commenterRole);
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

    private void dispatchCommentNotifications(Ticket ticket, TicketComment comment, UserRole commenterRole) {
        String commentAuthorId = comment.getUserId();
        String commentAuthorName = findUserDisplayName(commentAuthorId);
        String commentText = comment.getCommentText() == null ? "" : comment.getCommentText().trim();
        String commentPreview = commentText.length() > 120 ? commentText.substring(0, 120) + "..." : commentText;
        String ticketTitle = ticket.getTitle() == null ? "Untitled ticket" : ticket.getTitle();

        Set<String> notifiedUsers = new HashSet<>();
        if (commentAuthorId != null && !commentAuthorId.isBlank()) {
            notifiedUsers.add(commentAuthorId);
        }

        if (commenterRole == UserRole.ADMIN) {
            notifyUserIfEligible(
                ticket.getCreatedBy(),
                notifiedUsers,
                "Ticket Comment Added",
                "Admin added a comment on your ticket \"" + ticketTitle + "\": " + commentPreview,
                commentAuthorId
            );
            notifyUserIfEligible(
                ticket.getAssignedTechnician(),
                notifiedUsers,
                "Ticket Comment Added",
                "Admin added a comment on ticket \"" + ticketTitle + "\": " + commentPreview,
                commentAuthorId
            );
            return;
        }

        if (commenterRole == UserRole.TECHNICIAN) {
            notifyUserIfEligible(
                ticket.getCreatedBy(),
                notifiedUsers,
                "Ticket Comment Added",
                "Technician " + commentAuthorName + " added a comment on your ticket \"" + ticketTitle + "\": " + commentPreview,
                commentAuthorId
            );
            sendRoleTicketNotification(
                NotificationAudienceRole.ADMIN,
                "Ticket Comment Added",
                "Technician " + commentAuthorName + " commented on ticket \"" + ticketTitle + "\".",
                commentAuthorId
            );
            return;
        }

        if (commenterRole == UserRole.USER || commenterRole == UserRole.STUDENT || commenterRole == UserRole.Student) {
            notifyUserIfEligible(
                ticket.getAssignedTechnician(),
                notifiedUsers,
                "User Comment Added",
                "User added a comment on assigned ticket \"" + ticketTitle + "\": " + commentPreview,
                commentAuthorId
            );
            sendRoleTicketNotification(
                NotificationAudienceRole.ADMIN,
                "User Comment Added",
                "User " + commentAuthorName + " commented on ticket \"" + ticketTitle + "\".",
                commentAuthorId
            );
            return;
        }

        notifyUserIfEligible(
            ticket.getCreatedBy(),
            notifiedUsers,
            "Ticket Comment Added",
            commentAuthorName + " added a comment on ticket \"" + ticketTitle + "\": " + commentPreview,
            commentAuthorId
        );
    }

    private void notifyUserIfEligible(
        String recipientId,
        Set<String> notifiedUsers,
        String title,
        String message,
        String actorId
    ) {
        if (recipientId == null || recipientId.isBlank()) {
            return;
        }

        String resolvedRecipientId = resolveUserId(recipientId);
        if (resolvedRecipientId == null || resolvedRecipientId.isBlank() || notifiedUsers.contains(resolvedRecipientId)) {
            return;
        }

        sendUserTicketNotification(resolvedRecipientId, title, message, actorId);
        notifiedUsers.add(resolvedRecipientId);
    }

    private void sendUserTicketNotification(String userId, String title, String message, String actorId) {
        if (userId == null || userId.isBlank()) {
            return;
        }

        String resolvedUserId = resolveUserId(userId);
        if (resolvedUserId == null || resolvedUserId.isBlank()) {
            return;
        }

        try {
            notificationService.notifyUser(
                resolvedUserId,
                title,
                message,
                NotificationModule.TICKET,
                NotificationPriority.NORMAL,
                NotificationChannel.WEB,
                actorId
            );
        } catch (Exception notificationError) {
            LOGGER.warn("Ticket notification dispatch failed for userId={} title={}", resolvedUserId, title, notificationError);
        }
    }

    private void sendRoleTicketNotification(
        NotificationAudienceRole audienceRole,
        String title,
        String message,
        String actorId
    ) {
        try {
            notificationService.notifyRole(
                audienceRole,
                title,
                message,
                NotificationModule.TICKET,
                NotificationPriority.NORMAL,
                NotificationChannel.WEB,
                actorId
            );
        } catch (Exception notificationError) {
            LOGGER.warn("Ticket role notification dispatch failed for audience={} title={}", audienceRole, title, notificationError);
        }
    }

    private String resolveUserId(String userIdentifier) {
        if (userIdentifier == null || userIdentifier.isBlank()) {
            return userIdentifier;
        }

        String normalized = userIdentifier.trim();

        if (userRepository.existsById(normalized)) {
            return normalized;
        }

        return userRepository.findByEmailIgnoreCase(normalized)
            .map(User::getId)
            .orElseGet(() ->
                userRepository.findAll().stream()
                    .filter(user -> normalized.equalsIgnoreCase(user.getName()))
                    .findFirst()
                    .map(User::getId)
                    .orElse(normalized)
            );
    }

    private UserRole resolveRoleForActor(String actorId, String roleHint, Ticket ticket) {
        if (actorId != null && !actorId.isBlank()) {
            UserRole storedRole = userRepository.findById(actorId).map(User::getRole).orElse(null);
            if (storedRole != null) {
                return storedRole;
            }
        }

        UserRole parsedHint = parseRoleHint(roleHint);
        if (parsedHint != null) {
            return parsedHint;
        }

        if (ticket != null && actorId != null && !actorId.isBlank()) {
            if (actorId.equals(ticket.getAssignedTechnician())) {
                return UserRole.TECHNICIAN;
            }
            if (actorId.equals(ticket.getCreatedBy())) {
                return UserRole.USER;
            }
        }

        return UserRole.ADMIN;
    }

    private UserRole parseRoleHint(String roleHint) {
        if (roleHint == null || roleHint.isBlank()) {
            return null;
        }

        String normalized = roleHint.trim().toUpperCase(Locale.ROOT);
        if ("STUDENT".equals(normalized)) {
            normalized = "USER";
        }

        try {
            return UserRole.valueOf(normalized);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private String findUserDisplayName(String userIdentifier) {
        if (userIdentifier == null || userIdentifier.isBlank()) {
            return "Unknown user";
        }

        String resolvedId = resolveUserId(userIdentifier);
        return userRepository.findById(resolvedId)
            .map(user -> user.getName() != null && !user.getName().isBlank() ? user.getName() : user.getEmail())
            .orElse(resolvedId);
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
