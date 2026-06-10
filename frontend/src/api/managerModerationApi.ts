import { apiGet, apiPost } from './systemHttp';

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'needs_revision';

export interface ModerationCard {
  productId: number;
  productName: string;
  status: ModerationStatus;
  objectName?: string;
  varietyName?: string;
  freshnessName?: string;
  supplierId?: number;
  supplierName?: string;
  supplierEmail?: string;
  placeAddress?: string;
  price?: number;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  lastComment?: string;
}

export interface ModerationDocument {
  id: number;
  title: string;
  type: string;
  url: string;
  createdAt?: string;
}

export interface ModerationHistoryItem {
  id: number;
  productId: number;
  productName?: string;
  decision: ModerationStatus;
  comment?: string;
  moderatorName?: string;
  createdAt: string;
}

export async function getManagerModerationSummary() {
  return apiGet('/api/manager/moderation/summary');
}

export async function getManagerModerationCards(params: {
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value)) qs.set(key, String(value));
  });

  return apiGet(`/api/manager/moderation/cards?${qs.toString()}`);
}

export async function getManagerModerationCard(productId: number) {
  return apiGet(`/api/manager/moderation/cards/${productId}`);
}

export async function sendManagerModerationDecision(
  productId: number,
  payload: {
    decision: ModerationStatus;
    comment?: string;
  }
) {
  return apiPost(`/api/manager/moderation/cards/${productId}/decision`, payload);
}

export async function getManagerModerationHistory(params: {
  productId?: number;
  q?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value)) qs.set(key, String(value));
  });

  return apiGet(`/api/manager/moderation/history?${qs.toString()}`);
}
