const API_BASE_URL = 'http://localhost:5000';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`,
  'Content-Type': 'application/json'
});

export async function getMarketProducts() {
  const res = await fetch(`${API_BASE_URL}/api/buyer/market/products`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function getMarketPurchases() {
  const res = await fetch(`${API_BASE_URL}/api/buyer/market/purchases`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function createMarketPurchase(payload: { productId: number; quantity: number }) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/market/purchase`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}