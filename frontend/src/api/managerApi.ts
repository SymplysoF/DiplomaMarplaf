import { apiGet, apiSend, toQuery } from './systemHttp';

export function getManagerOverview() {
  return apiGet('/api/manager/overview');
}

export function getManagerCards(params: {
  status?: 'pending' | 'approved' | 'rejected' | 'revision' | 'all';
  page?: number;
  limit?: number;
  search?: string;
}) {
  return apiGet(`/api/manager/moderation/cards${toQuery({
    status: params.status || 'pending',
    page: params.page || 1,
    limit: params.limit || 12,
    search: params.search || ''
  })}`);
}

export function getManagerCard(id: number) {
  return apiGet(`/api/manager/moderation/cards/${id}`);
}

export function saveManagerCardDecision(id: number, payload: {
  decision: 'approved' | 'rejected' | 'revision';
  comment: string;
}) {
  return apiSend(`/api/manager/moderation/cards/${id}/decision`, 'POST', payload);
}

export function getManagerHistory(params: { page?: number; limit?: number; search?: string } = {}) {
  return apiGet(`/api/manager/moderation/history${toQuery({
    page: params.page || 1,
    limit: params.limit || 50,
    search: params.search || ''
  })}`);
}

export function getManagerUsers(params: {
  status?: 'pending' | 'verified' | 'rejected' | 'revision' | 'all';
  page?: number;
  limit?: number;
  search?: string;
} = {}) {
  return apiGet(`/api/manager/users${toQuery({
    status: params.status || 'all',
    page: params.page || 1,
    limit: params.limit || 20,
    search: params.search || ''
  })}`);
}

export function saveManagerUserDecision(id: number, payload: {
  decision: 'verified' | 'rejected' | 'revision';
  comment: string;
}) {
  return apiSend(`/api/manager/users/${id}/decision`, 'POST', payload);
}

export function getManagerCertificates(params: { page?: number; limit?: number; search?: string } = {}) {
  return apiGet(`/api/manager/certificates${toQuery({
    page: params.page || 1,
    limit: params.limit || 20,
    search: params.search || ''
  })}`);
}

export function getManagerAppeals(params: {
  status?: 'open' | 'in_progress' | 'closed' | 'all';
  page?: number;
  limit?: number;
  search?: string;
} = {}) {
  return apiGet(`/api/manager/appeals${toQuery({
    status: params.status || 'open',
    page: params.page || 1,
    limit: params.limit || 20,
    search: params.search || ''
  })}`);
}

export function updateManagerAppeal(id: number, payload: {
  status: 'open' | 'in_progress' | 'closed';
  answer?: string;
}) {
  return apiSend(`/api/manager/appeals/${id}`, 'PUT', payload);
}
