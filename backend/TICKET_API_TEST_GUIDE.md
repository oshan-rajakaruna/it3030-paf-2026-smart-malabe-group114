# Ticket API Test Guide

This guide helps you test the current Incident Ticket API running in the backend.

Base URL:

```text
http://localhost:8080
```

Make sure:

- the Spring Boot backend is running
- MySQL is running locally
- the database connection in `application.properties` is working

## 1. Create Ticket

Use this endpoint to create a new incident ticket.

- Method: `POST`
- URL: `http://localhost:8080/api/tickets`

Example request body:

```json
{
  "title": "Projector not working",
  "description": "The classroom projector in Room A201 does not turn on.",
  "location": "Room A201",
  "category": "EQUIPMENT",
  "priority": "HIGH",
  "createdBy": "lecture.hall.coordinator"
}
```

Example `curl`:

```bash
curl -X POST http://localhost:8080/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Projector not working",
    "description": "The classroom projector in Room A201 does not turn on.",
    "location": "Room A201",
    "category": "EQUIPMENT",
    "priority": "HIGH",
    "createdBy": "lecture.hall.coordinator"
  }'
```

Expected response meaning:

- Status `201 Created` means the ticket was successfully saved
- the response body contains the created ticket details
- `status` should usually be `OPEN` for a newly created ticket

Example response:

```json
{
  "id": 1,
  "title": "Projector not working",
  "description": "The classroom projector in Room A201 does not turn on.",
  "location": "Room A201",
  "category": "EQUIPMENT",
  "priority": "HIGH",
  "status": "OPEN",
  "createdBy": "lecture.hall.coordinator",
  "assignedTechnician": null,
  "resolutionNotes": null,
  "createdAt": "2026-04-16T10:15:30",
  "updatedAt": "2026-04-16T10:15:30"
}
```

## 2. Get All Tickets

Use this endpoint to retrieve all saved tickets.

- Method: `GET`
- URL: `http://localhost:8080/api/tickets`

Example `curl`:

```bash
curl http://localhost:8080/api/tickets
```

Expected response meaning:

- Status `200 OK` means the request was successful
- the response body contains a list of tickets
- if there are no tickets yet, the response may be an empty array: `[]`

Example response:

```json
[
  {
    "id": 1,
    "title": "Projector not working",
    "description": "The classroom projector in Room A201 does not turn on.",
    "location": "Room A201",
    "category": "EQUIPMENT",
    "priority": "HIGH",
    "status": "OPEN",
    "createdBy": "lecture.hall.coordinator",
    "assignedTechnician": null,
    "resolutionNotes": null,
    "createdAt": "2026-04-16T10:15:30",
    "updatedAt": "2026-04-16T10:15:30"
  }
]
```

## 3. Get Ticket By ID

Use this endpoint to retrieve one specific ticket by its ID.

- Method: `GET`
- URL example: `http://localhost:8080/api/tickets/1`

Example `curl`:

```bash
curl http://localhost:8080/api/tickets/1
```

Expected response meaning:

- Status `200 OK` means the ticket was found
- the response body contains one ticket object
- if the ID does not exist, the current backend may return an error because advanced exception handling has not been added yet

Example response:

```json
{
  "id": 1,
  "title": "Projector not working",
  "description": "The classroom projector in Room A201 does not turn on.",
  "location": "Room A201",
  "category": "EQUIPMENT",
  "priority": "HIGH",
  "status": "OPEN",
  "createdBy": "lecture.hall.coordinator",
  "assignedTechnician": null,
  "resolutionNotes": null,
  "createdAt": "2026-04-16T10:15:30",
  "updatedAt": "2026-04-16T10:15:30"
}
```

## Useful Notes

- Valid `category` values: `ELECTRICAL`, `NETWORK`, `EQUIPMENT`, `FACILITY`, `OTHER`
- Valid `priority` values: `LOW`, `MEDIUM`, `HIGH`
- You can test these endpoints using Postman, Insomnia, or `curl`
