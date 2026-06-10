const API_BASE_URL = 'http://localhost:5000';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`,
  'Content-Type': 'application/json'
});

const authOnlyHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`
});

export async function getSupplierWarehouseProducts() {
  const res = await fetch(`${API_BASE_URL}/api/supplier/warehouse`, {
    headers: authOnlyHeaders()
  });
  return res.json();
}

export async function getSupplierPlaces() {
  const res = await fetch(`${API_BASE_URL}/api/supplier/places`, {
    headers: authOnlyHeaders()
  });
  return res.json();
}

export async function updateSupplierWarehouseProduct(
  productCopyId: number,
  payload: {
    wholepart: number;
    copecks: number;
    discount: number;
  }
) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/warehouse/${productCopyId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function moveSupplierWarehouseProduct(
  productCopyId: number,
  payload: {
    newLocation: 1 | 2 | 3;
  }
) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/warehouse/${productCopyId}/move`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function deleteSupplierWarehouseProduct(productCopyId: number) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/warehouse/${productCopyId}`, {
    method: 'DELETE',
    headers: authOnlyHeaders()
  });
  return res.json();
}