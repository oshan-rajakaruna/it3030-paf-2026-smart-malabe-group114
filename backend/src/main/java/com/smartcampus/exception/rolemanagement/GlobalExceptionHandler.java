package com.smartcampus.exception.rolemanagement;

import java.time.LocalDateTime;
import java.util.stream.Collectors;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

  @ExceptionHandler(ResourceNotFoundException.class)
  public ResponseEntity<ApiErrorResponse> handleNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
    return buildError(HttpStatus.NOT_FOUND, ex.getMessage(), request.getRequestURI());
  }

  @ExceptionHandler(BadRequestException.class)
  public ResponseEntity<ApiErrorResponse> handleBadRequest(BadRequestException ex, HttpServletRequest request) {
    return buildError(HttpStatus.BAD_REQUEST, ex.getMessage(), request.getRequestURI());
  }

  @ExceptionHandler(UnauthorizedException.class)
  public ResponseEntity<ApiErrorResponse> handleUnauthorized(UnauthorizedException ex, HttpServletRequest request) {
    return buildError(HttpStatus.FORBIDDEN, ex.getMessage(), request.getRequestURI());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
    String message = ex.getBindingResult().getFieldErrors().stream()
      .map(error -> error.getField() + ": " + error.getDefaultMessage())
      .collect(Collectors.joining("; "));
    return buildError(HttpStatus.BAD_REQUEST, message, request.getRequestURI());
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ApiErrorResponse> handleReadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
    return buildError(HttpStatus.BAD_REQUEST, "Request body is invalid or contains unsupported values", request.getRequestURI());
  }

  @ExceptionHandler(DuplicateKeyException.class)
  public ResponseEntity<ApiErrorResponse> handleDuplicateKey(DuplicateKeyException ex, HttpServletRequest request) {
    String raw = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
    String normalized = raw == null ? "" : raw.toLowerCase();
    String message;
    if (normalized.contains("email")) {
      message = "Email is already registered";
    } else if (normalized.contains("idnumber") || normalized.contains("id_number") || normalized.contains("id number")) {
      message = "ID number is already registered";
    } else {
      message = "Duplicate value found. Email or ID may already exist.";
    }
    return buildError(HttpStatus.BAD_REQUEST, message, request.getRequestURI());
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<ApiErrorResponse> handleResponseStatus(ResponseStatusException ex, HttpServletRequest request) {
    HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
    HttpStatus resolvedStatus = status == null ? HttpStatus.BAD_REQUEST : status;
    String message = ex.getReason() == null || ex.getReason().isBlank()
      ? resolvedStatus.getReasonPhrase()
      : ex.getReason();

    return buildError(resolvedStatus, message, request.getRequestURI());
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiErrorResponse> handleGeneric(Exception ex, HttpServletRequest request) {
    log.error("Unhandled server error on {}: {}", request.getRequestURI(), ex.getMessage(), ex);
    String message = (ex.getMessage() == null || ex.getMessage().isBlank())
      ? "Unexpected server error"
      : ex.getMessage();
    return buildError(HttpStatus.INTERNAL_SERVER_ERROR, message, request.getRequestURI());
  }

  private ResponseEntity<ApiErrorResponse> buildError(HttpStatus status, String message, String path) {
    ApiErrorResponse body = ApiErrorResponse.builder()
      .timestamp(LocalDateTime.now())
      .status(status.value())
      .error(status.getReasonPhrase())
      .message(message)
      .path(path)
      .build();
    return ResponseEntity.status(status).body(body);
  }
}



