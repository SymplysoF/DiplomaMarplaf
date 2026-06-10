const API_BASE_URL = 'http://localhost:5000';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`,
  'Content-Type': 'application/json'
});

export async function getSupplierCustomerRequests() {
  const res = await fetch(`${API_BASE_URL}/api/supplier/customer-requests`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`
    }
  });
  return res.json();
}

export async function getSupplierMyRequestResponses() {
  const res = await fetch(`${API_BASE_URL}/api/supplier/customer-requests/my-responses`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`
    }
  });
  return res.json();
}

export async function getSupplierResponsesForRequest(requestId: number) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/customer-requests/${requestId}/responses`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`
    }
  });
  return res.json();
}

export async function createSupplierResponse(
  requestId: number,
  payload: {
    offered_price_whole: number;
    offered_price_copecks?: number;
    estimated_quantity: number;
    delivery_days: number;
    response_text?: string;
  }
) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/customer-requests/${requestId}/respond`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function updateSupplierResponse(
  responseId: number,
  payload: {
    offered_price_whole: number;
    offered_price_copecks?: number;
    estimated_quantity: number;
    delivery_days: number;
    response_text?: string;
  }
) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/customer-requests/responses/${responseId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}