const API_BASE_URL = 'http://localhost:5000';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`,
  'Content-Type': 'application/json'
});

export async function getBuyerSubscriptions() {
  const res = await fetch(`${API_BASE_URL}/api/buyer/subscriptions`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function createBuyerSubscription(supplierId: number) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/subscriptions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ supplierId })
  });
  return res.json();
}

export async function deleteBuyerSubscription(supplierId: number) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/subscriptions/${supplierId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}