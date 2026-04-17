const RESOURCE_API_BASE_URL = 'http://localhost:8080/api/resources';

function buildResourceUrl(filters = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'ALL') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();
  return queryString ? `${RESOURCE_API_BASE_URL}?${queryString}` : RESOURCE_API_BASE_URL;
}

async function handleResponse(response) {
  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(errorMessage || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function getResources(filters = {}) {
  const response = await fetch(buildResourceUrl(filters));
  return handleResponse(response);
}

export async function getResourceById(id) {
  const response = await fetch(`${RESOURCE_API_BASE_URL}/${id}`);
  return handleResponse(response);
}

export async function createResource(data) {
  const response = await fetch(RESOURCE_API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
}

export async function updateResource(id, data) {
  const response = await fetch(`${RESOURCE_API_BASE_URL}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
}

export async function deleteResource(id) {
  const response = await fetch(`${RESOURCE_API_BASE_URL}/${id}`, {
    method: 'DELETE',
  });

  return handleResponse(response);
}
