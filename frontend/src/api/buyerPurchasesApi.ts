const API_BASE_URL = 'http://localhost:5000';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`,
  'Content-Type': 'application/json'
});

export async function getBuyerPurchases() {
  const res = await fetch(`${API_BASE_URL}/api/buyer/purchases`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function getBuyerPurchaseById(id: number) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/purchases/${id}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function updateBuyerPurchase(id: number, payload: any) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/purchases/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function deleteBuyerPurchase(id: number) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/purchases/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}