export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export const getToken = () => localStorage.getItem('userToken') || '';

export const authHeaders = (json = true): HeadersInit => {
  const headers: HeadersInit = {
    Authorization: `Bearer ${getToken()}`
  };

  if (json) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
};

export function toQuery(params: Record<string, any>) {
  const q = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      q.set(key, String(value));
    }
  });

  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function apiGet<T = any>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    headers: authHeaders(false)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }

  return data;
}

export async function apiSend<T = any>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: any
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    method,
    headers: authHeaders(true),
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }

  return data;
}

export function apiPost<T = any>(url: string, body?: any): Promise<T> {
  return apiSend<T>(url, 'POST', body);
}

export function apiPut<T = any>(url: string, body?: any): Promise<T> {
  return apiSend<T>(url, 'PUT', body);
}

export function apiPatch<T = any>(url: string, body?: any): Promise<T> {
  return apiSend<T>(url, 'PATCH', body);
}

export function apiDelete<T = any>(url: string, body?: any): Promise<T> {
  return apiSend<T>(url, 'DELETE', body);
}

export function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows?.length) return;

  const columnSet = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      columnSet.add(key);
    });
  });

  const cols: string[] = Array.from(columnSet);

  const esc = (value: any): string => {
    const text = String(value ?? '');
    return `"${text.replaceAll('"', '""')}"`;
  };

  const csvLines: string[] = [
    cols.map(esc).join(';'),
    ...rows.map((row) =>
      cols.map((col: string) => esc(row[col])).join(';')
    )
  ];

  const csv = csvLines.join('\n');

  const blob = new Blob(['\ufeff' + csv], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}