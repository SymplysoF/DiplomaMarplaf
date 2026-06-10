const API_BASE_URL = 'http://localhost:5000';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`,
  'Content-Type': 'application/json'
});

export async function getSupplierAuctions() {
  const res = await fetch(`${API_BASE_URL}/api/supplier/auctions`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function getSupplierAuctionById(auctionId: number) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/auctions/${auctionId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function getSupplierAuctionBids(auctionId: number) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/auctions/${auctionId}/bids`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function getSupplierAuctionProducts() {
  const res = await fetch(`${API_BASE_URL}/api/supplier/auction-products`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function createSupplierAuction(payload: {
  title: string;
  idproduct: number;
  startprice: number;
  minstep: number;
  buynowprice?: number | null;
  starttime: string;
  endtime: string;
  vatincluded: boolean;
  deliveryregion: string;
  idplace: number;
  description?: string;
}) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/auctions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function updateSupplierAuction(
  auctionId: number,
  payload: {
    title: string;
    startprice: number;
    minstep: number;
    buynowprice?: number | null;
    starttime: string;
    endtime: string;
    vatincluded: boolean;
    deliveryregion: string;
    idplace: number;
    description?: string;
  }
) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/auctions/${auctionId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function updateSupplierAuctionStatus(
  auctionId: number,
  payload: { status: 'draft' | 'active' | 'cancelled' }
) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/auctions/${auctionId}/status`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function deleteSupplierAuction(auctionId: number) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/auctions/${auctionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}