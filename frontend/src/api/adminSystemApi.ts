import { apiGet, apiSend, toQuery } from './systemHttp';

export type AdminTableKey =
  | 'users'
  | 'roles'
  | 'suppliers'
  | 'products'
  | 'productCopies'
  | 'purchases'
  | 'auctions'
  | 'certificates'
  | 'logs'
  | 'namesObjects'
  | 'freshness'
  | 'dimensions';

export function getAdminSummary() {
  return apiGet('/api/admin-system/summary');
}

export function getAdminTable(table: AdminTableKey, params: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
} = {}) {
  return apiGet(`/api/admin-system/tables/${table}${toQuery({
    page: params.page || 1,
    limit: params.limit || 20,
    search: params.search || '',
    sortBy: params.sortBy || 'id',
    sortDir: params.sortDir || 'desc'
  })}`);
}

export function getAdminSuppliers(params: { page?: number; limit?: number; search?: string } = {}) {
  return apiGet(`/api/admin-system/suppliers${toQuery({
    page: params.page || 1,
    limit: params.limit || 20,
    search: params.search || ''
  })}`);
}

export function createAdminUser(payload: {
  username: string;
  email: string;
  password: string;
  roleId: number;
}) {
  return apiSend('/api/admin-system/users', 'POST', payload);
}

export function updateAdminUserStatus(id: number, payload: { isActive: boolean }) {
  return apiSend(`/api/admin-system/users/${id}/status`, 'PUT', payload);
}
