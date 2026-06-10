const API_BASE_URL = 'http://localhost:5000';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`,
  'Content-Type': 'application/json'
});

export interface BuyerProfile {
  id: number;
  username: string;
  email: string;
  deliveryaddress: string;
  contactphone: string;
}

export async function getBuyerProfile() {
  const res = await fetch(`${API_BASE_URL}/api/buyer/profile`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function updateBuyerProfile(payload: Partial<BuyerProfile>) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/profile`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}