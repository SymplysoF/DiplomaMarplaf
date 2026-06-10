const API_BASE_URL = 'http://localhost:5000';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`,
  'Content-Type': 'application/json'
});

export async function getBuyerRequests() {
  const res = await fetch(`${API_BASE_URL}/api/buyer/requests`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function createBuyerRequest(payload: any) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/requests`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function updateBuyerRequest(id: number, payload: any) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/requests/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function deleteBuyerRequest(id: number) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/requests/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function getBuyerRequestResponses(id: number) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/requests/${id}/responses`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}