const BASE_URL = 'http://localhost:8080/api/tickets';

async function handleResponse(response) {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Request failed');
  }

  return response.json();
}

export async function getAllTickets() {
  const response = await fetch(BASE_URL);
  return handleResponse(response);
}

export async function createTicket(data) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
}

export async function getTicketById(id) {
  const response = await fetch(`${BASE_URL}/${id}`);
  return handleResponse(response);
}

export async function updateTicketStatus(id, status, rejectionReason = '') {
  const response = await fetch(`${BASE_URL}/${id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status, rejectionReason }),
  });

  return handleResponse(response);
}

export async function assignTechnician(id, technician) {
  const response = await fetch(`${BASE_URL}/${id}/assign`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ assignedTechnician: technician }),
  });

  return handleResponse(response);
}

export async function updateTicketResolution(id, resolutionNotes) {
  const response = await fetch(`${BASE_URL}/${id}/resolution`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ resolutionNotes }),
  });

  return handleResponse(response);
}

export async function addComment(id, data) {
  const response = await fetch(`${BASE_URL}/${id}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
}

export async function getComments(id) {
  const response = await fetch(`${BASE_URL}/${id}/comments`);
  return handleResponse(response);
}

export async function uploadAttachment(id, file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BASE_URL}/${id}/attachments`, {
    method: 'POST',
    body: formData,
  });

  return handleResponse(response);
}

export async function getAttachments(id) {
  const response = await fetch(`${BASE_URL}/${id}/attachments`);
  return handleResponse(response);
}

export async function deleteTicket(id) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to delete ticket');
  }
}
