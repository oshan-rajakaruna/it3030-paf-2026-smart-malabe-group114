package com.smartcampus.controller;

import java.util.List;

import com.smartcampus.dto.ticket.AddTicketCommentRequest;
import com.smartcampus.dto.ticket.AssignTechnicianRequest;
import com.smartcampus.dto.ticket.CreateTicketRequest;
import com.smartcampus.dto.ticket.TicketCommentResponse;
import com.smartcampus.dto.ticket.TicketResponse;
import com.smartcampus.dto.ticket.UpdateTicketCommentRequest;
import com.smartcampus.dto.ticket.UpdateResolutionRequest;
import com.smartcampus.dto.ticket.UpdateTicketStatusRequest;
import com.smartcampus.model.TicketAttachment;
import com.smartcampus.service.TicketService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    @PostMapping
    public ResponseEntity<TicketResponse> createTicket(@RequestBody CreateTicketRequest request) {
        TicketResponse response = ticketService.createTicket(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<TicketResponse>> getAllTickets() {
        return ResponseEntity.ok(ticketService.getAllTickets());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TicketResponse> getTicketById(@PathVariable String id) {
        return ResponseEntity.ok(ticketService.getTicketById(id));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<TicketResponse> updateTicketStatus(
        @PathVariable String id,
        @RequestBody UpdateTicketStatusRequest request
    ) {
        return ResponseEntity.ok(ticketService.updateTicketStatus(id, request));
    }

    @PutMapping("/{id}/assign")
    public ResponseEntity<TicketResponse> assignTechnician(
        @PathVariable String id,
        @RequestBody AssignTechnicianRequest request
    ) {
        return ResponseEntity.ok(ticketService.assignTechnician(id, request));
    }

    @PutMapping("/{id}/resolution")
    public ResponseEntity<TicketResponse> updateResolutionNotes(
        @PathVariable String id,
        @RequestBody UpdateResolutionRequest request
    ) {
        return ResponseEntity.ok(ticketService.updateResolutionNotes(id, request));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<TicketCommentResponse> addComment(
        @PathVariable String id,
        @RequestBody AddTicketCommentRequest request
    ) {
        TicketCommentResponse response = ticketService.addComment(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<List<TicketCommentResponse>> getCommentsByTicketId(@PathVariable String id) {
        return ResponseEntity.ok(ticketService.getCommentsByTicketId(id));
    }

    @PutMapping("/{ticketId}/comments/{commentId}")
    public ResponseEntity<TicketCommentResponse> updateComment(
        @PathVariable String ticketId,
        @PathVariable String commentId,
        @RequestBody UpdateTicketCommentRequest request
    ) {
        return ResponseEntity.ok(ticketService.updateComment(ticketId, commentId, request));
    }

    @DeleteMapping("/{ticketId}/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(
        @PathVariable String ticketId,
        @PathVariable String commentId,
        @RequestParam String userId,
        @RequestParam(defaultValue = "false") boolean admin
    ) {
        ticketService.deleteComment(ticketId, commentId, userId, admin);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/attachments")
    public ResponseEntity<TicketAttachment> uploadAttachment(
        @PathVariable String id,
        @RequestParam("file") MultipartFile file
    ) {
        TicketAttachment response = ticketService.uploadAttachment(id, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}/attachments")
    public ResponseEntity<List<TicketAttachment>> getAttachmentsByTicketId(@PathVariable String id) {
        return ResponseEntity.ok(ticketService.getAttachmentsByTicketId(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTicket(@PathVariable String id) {
        ticketService.deleteTicket(id);
        return ResponseEntity.noContent().build();
    }
}
