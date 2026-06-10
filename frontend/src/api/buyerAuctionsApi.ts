const API_BASE_URL = 'http://localhost:5000';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`,
  'Content-Type': 'application/json'
});

export async function getBuyerAuctions() {
  const res = await fetch(`${API_BASE_URL}/api/buyer/auctions`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function getBuyerAuctionById(auctionId: number) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/auctions/${auctionId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function getBuyerAuctionBids(auctionId: number) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/auctions/${auctionId}/bids`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function placeBuyerBid(auctionId: number, amount: number) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/auctions/${auctionId}/bid`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount })
  });
  return res.json();
}

export async function getBuyerMyBids() {
  const res = await fetch(`${API_BASE_URL}/api/buyer/my-bids`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}

export async function updateBuyerMyBid(bidId: number, amount: number) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/my-bids/${bidId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ amount })
  });
  return res.json();
}

export async function deleteBuyerMyBid(bidId: number) {
  const res = await fetch(`${API_BASE_URL}/api/buyer/my-bids/${bidId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('userToken') || ''}` }
  });
  return res.json();
}