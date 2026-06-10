import { PoolClient } from 'pg';

export const q = (name: string) => `"${String(name).replace(/"/g, '""')}"`;
export const qt = (name: string) => `public.${q(name)}`;

export async function tableExists(client: PoolClient, tableName: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1`,
    [tableName]
  );
  return r.rows.length > 0;
}

export async function firstExistingTable(client: PoolClient, names: string[]): Promise<string | null> {
  for (const name of names) if (await tableExists(client, name)) return name;
  return null;
}

export async function columnExists(client: PoolClient, tableName: string, columnName: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`,
    [tableName, columnName]
  );
  return r.rows.length > 0;
}

export async function firstExistingColumn(client: PoolClient, tableName: string, names: string[]): Promise<string | null> {
  for (const name of names) if (await columnExists(client, tableName, name)) return name;
  return null;
}

export async function getColumns(client: PoolClient, tableName: string): Promise<string[]> {
  const r = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [tableName]
  );
  return r.rows.map(x => x.column_name);
}

export async function safeCount(client: PoolClient, tableName: string | null, whereSql = 'TRUE', params: any[] = []) {
  if (!tableName) return 0;
  try {
    const r = await client.query(`SELECT COUNT(*)::int AS count FROM ${qt(tableName)} WHERE ${whereSql}`, params);
    return Number(r.rows[0]?.count || 0);
  } catch (e: any) {
    console.warn(`safeCount skipped for ${tableName}:`, e.message);
    return 0;
  }
}

export function like(value: any) {
  return `%${String(value || '').trim().toLowerCase()}%`;
}

export function pagination(query: any, maxLimit = 100) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit || 20)));
  return { page, limit, offset: (page - 1) * limit };
}

export function orderBySafe(sortBy: any, sortDir: any, allowed: string[], fallback = 'id') {
  const col = allowed.includes(String(sortBy)) ? String(sortBy) : fallback;
  const dir = String(sortDir || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${q(col)} ${dir}`;
}
