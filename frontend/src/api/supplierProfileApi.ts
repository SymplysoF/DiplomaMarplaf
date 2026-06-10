const API_BASE_URL = 'http://localhost:5000';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`,
  'Content-Type': 'application/json'
});

export async function getSupplierProfile() {
  const res = await fetch(`${API_BASE_URL}/api/supplier/profile`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function updateSupplierProfile(payload: {
  name: string;
  description?: string;
  rating?: number;
}) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/profile`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}