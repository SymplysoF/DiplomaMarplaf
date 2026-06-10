const API_BASE_URL = 'http://localhost:5000';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`,
  'Content-Type': 'application/json'
});

const authOnlyHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`
});

export async function getSupplierMarketProducts() {
  const res = await fetch(`${API_BASE_URL}/api/supplier/market/products`, {
    headers: authOnlyHeaders()
  });
  return res.json();
}

export async function getSupplierMarketPurchases() {
  const res = await fetch(`${API_BASE_URL}/api/supplier/market/purchases`, {
    headers: authOnlyHeaders()
  });
  return res.json();
}

export async function createSupplierMarketPurchase(payload: {
  idproductcopy: number;
  quantity: number;
  paymentmethod: string;
  deliveryaddress?: string;
  contactphone?: string;
  contactemail?: string;
  comment?: string;
}) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/market/purchases`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function updateSupplierMarketPurchaseStatus(
  purchaseId: number,
  payload: { status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' }
) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/market/purchases/${purchaseId}/status`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}