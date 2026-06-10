import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Pool, PoolClient } from 'pg';
import {
  columnExists, firstExistingTable, getColumns, like, orderBySafe,
  pagination, q, qt, safeCount, tableExists
} from '../../utils/dbSchema';

type Middleware = (req: Request, res: Response, next: any) => any;

interface Deps {
  pool: Pool;
  authenticateToken: Middleware;
  requireRole: (roleId: number) => Middleware;
}

async function ensureBase(client: PoolClient) {
  await client.query(`
    INSERT INTO public.roles (id, name)
    VALUES
      (1, 'Администратор'),
      (2, 'Поставщик'),
      (3, 'Покупатель'),
      (4, 'Модератор'),
      (5, 'Регулятор')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  `);

  await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true`);
}

async function usersTable(client: PoolClient, req: Request, res: Response) {
  const { page, limit, offset } = pagination(req.query);
  const search = String(req.query.search || '');
  const params: any[] = [];
  let where = '';

  if (search) {
    params.push(like(search));
    where = `WHERE LOWER(COALESCE(u."userName", '')) LIKE $1 OR LOWER(COALESCE(u.email, '')) LIKE $1`;
  }

  const count = await client.query(`SELECT COUNT(*)::int AS total FROM public.users u ${where}`, params);

  const result = await client.query(
    `
    SELECT
      u.id,
      u."userName" AS username,
      u.email,
      u."roleId" AS "roleId",
      COALESCE(r.name, 'Пользователь') AS "roleName",
      COALESCE(u."isActive", true) AS "isActive"
    FROM public.users u
    LEFT JOIN public.roles r ON r.id = u."roleId"
    ${where}
    ORDER BY u.id DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    [...params, limit, offset]
  );

  return res.json({
    success: true,
    rows: result.rows,
    columns: ['id', 'username', 'email', 'roleId', 'roleName', 'isActive'],
    pagination: { page, limit, total: count.rows[0].total, pages: Math.max(1, Math.ceil(count.rows[0].total / limit)) }
  });
}

async function suppliersTable(client: PoolClient, req: Request, res: Response) {
  const { page, limit, offset } = pagination(req.query);
  const search = String(req.query.search || '');
  const hasDescription = await columnExists(client, 'suppliers', 'description');
  const hasRating = await columnExists(client, 'suppliers', 'rating');

  const params: any[] = [];
  let where = '';

  if (search) {
    params.push(like(search));
    where = `
      WHERE LOWER(COALESCE(s.name, '')) LIKE $1
         OR LOWER(COALESCE(u."userName", '')) LIKE $1
         OR LOWER(COALESCE(u.email, '')) LIKE $1
    `;
  }

  const count = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM public.suppliers s
    LEFT JOIN public.users u ON u.id = s."userId"
    ${where}
    `,
    params
  );

  const result = await client.query(
    `
    SELECT
      s.id,
      s.name,
      s."userId" AS "userId",
      u."userName" AS username,
      u.email,
      ${hasRating ? 's.rating' : '0.0::numeric'} AS rating,
      ${hasDescription ? 's.description' : "''::text"} AS description,
      (
        SELECT COUNT(*)::int
        FROM public."supplierPlaces" sp
        WHERE sp."idSupplier" = s.id
      ) AS "placesCount",
      (
        SELECT COUNT(*)::int
        FROM public."supplierPlacesProducts" spp
        JOIN public."supplierPlaces" sp ON sp.id = spp."idSupplierPlace"
        WHERE sp."idSupplier" = s.id
      ) AS "productsCount"
    FROM public.suppliers s
    LEFT JOIN public.users u ON u.id = s."userId"
    ${where}
    ORDER BY s.id DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    [...params, limit, offset]
  );

  return res.json({
    success: true,
    suppliers: result.rows,
    rows: result.rows,
    columns: ['id', 'name', 'userId', 'username', 'email', 'rating', 'placesCount', 'productsCount'],
    pagination: { page, limit, total: count.rows[0].total, pages: Math.max(1, Math.ceil(count.rows[0].total / limit)) }
  });
}

async function productsTable(client: PoolClient, req: Request, res: Response) {
  const { page, limit, offset } = pagination(req.query);
  const search = String(req.query.search || '');
  const params: any[] = [];
  let where = '';

  if (search) {
    params.push(like(search));
    where = `WHERE LOWER(COALESCE(p.name, '')) LIKE $1 OR LOWER(COALESCE(no.name, '')) LIKE $1`;
  }

  const hasProductCopies = await tableExists(client, 'productCopies');
  const hasFreshness = await tableExists(client, 'freshness');

  const count = await client.query(
    `
    SELECT COUNT(*)::int AS total
    FROM public.products p
    LEFT JOIN public."namesObjects" no ON no.id = p."idObject"
    ${where}
    `,
    params
  );

  const result = await client.query(
    `
    SELECT
      p.id,
      p.name,
      p."idObject",
      no.name AS "cultureName",
      no."idVariety" AS "varietyId",
      ${hasProductCopies ? 'pc."wholePart"' : 'NULL'} AS "wholePart",
      ${hasProductCopies ? 'pc.copecks' : 'NULL'} AS copecks,
      ${hasProductCopies ? 'pc.weight' : 'NULL'} AS weight,
      ${hasProductCopies ? 'pc."isActual"' : 'NULL'} AS "isActual",
      ${hasFreshness && hasProductCopies ? 'fr.name' : 'NULL'} AS "freshnessName"
    FROM public.products p
    LEFT JOIN public."namesObjects" no ON no.id = p."idObject"
    ${hasProductCopies ? 'LEFT JOIN public."productCopies" pc ON pc."idProduct" = p.id' : ''}
    ${hasProductCopies && hasFreshness ? 'LEFT JOIN public.freshness fr ON fr.id = pc."idFreshness"' : ''}
    ${where}
    ORDER BY p.id DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    [...params, limit, offset]
  );

  return res.json({
    success: true,
    rows: result.rows,
    columns: ['id', 'name', 'idObject', 'cultureName', 'varietyId', 'wholePart', 'copecks', 'weight', 'isActual', 'freshnessName'],
    pagination: { page, limit, total: count.rows[0].total, pages: Math.max(1, Math.ceil(count.rows[0].total / limit)) }
  });
}

async function genericTable(client: PoolClient, req: Request, res: Response, key: string) {
  const tableMap: Record<string, string[]> = {
    roles: ['roles'],
    productCopies: ['productCopies'],
    purchases: ['purchases'],
    auctions: ['auctions'],
    certificates: ['certificates', 'supplierCertificates', 'documents'],
    logs: ['systemLogs', 'logs', 'auditLogs'],
    namesObjects: ['namesObjects'],
    freshness: ['freshness'],
    dimensions: ['dimensions', 'dimension']
  };

  const table = await firstExistingTable(client, tableMap[key] || [key]);
  const { page, limit, offset } = pagination(req.query);

  if (!table) {
    return res.json({
      success: true,
      rows: [],
      columns: [],
      pagination: { page, limit, total: 0, pages: 1 },
      message: `Таблица ${key} отсутствует`
    });
  }

  const columns = await getColumns(client, table);
  const sort = orderBySafe(req.query.sortBy || 'id', req.query.sortDir || 'desc', columns, columns.includes('id') ? 'id' : columns[0]);
  const search = String(req.query.search || '');

  let where = '';
  const params: any[] = [];

  if (search) {
    const searchable = columns.filter(c => !['id'].includes(c));
    if (searchable.length) {
      params.push(like(search));
      where = `WHERE ${searchable.map(c => `LOWER(COALESCE(${q(c)}::text, '')) LIKE $1`).join(' OR ')}`;
    }
  }

  const count = await client.query(`SELECT COUNT(*)::int AS total FROM ${qt(table)} ${where}`, params);

  const result = await client.query(
    `
    SELECT *
    FROM ${qt(table)}
    ${where}
    ORDER BY ${sort}
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    [...params, limit, offset]
  );

  return res.json({
    success: true,
    rows: result.rows,
    columns,
    pagination: { page, limit, total: count.rows[0].total, pages: Math.max(1, Math.ceil(count.rows[0].total / limit)) }
  });
}

export default function createAdminSystemRouter({ pool, authenticateToken, requireRole }: Deps) {
  const router = Router();

  router.use(authenticateToken, requireRole(1));

  router.get('/summary', async (_req, res) => {
    const client = await pool.connect();
    try {
      await ensureBase(client);

      const summary = {
        users: await safeCount(client, 'users'),
        suppliers: await safeCount(client, 'suppliers'),
        products: await safeCount(client, 'products'),
        purchases: await safeCount(client, await firstExistingTable(client, ['purchases'])),
        auctions: await safeCount(client, await firstExistingTable(client, ['auctions'])),
        certificates: await safeCount(client, await firstExistingTable(client, ['certificates', 'supplierCertificates', 'documents'])),
        logs: await safeCount(client, await firstExistingTable(client, ['systemLogs', 'logs', 'auditLogs']))
      };

      return res.json({ success: true, summary });
    } catch (error: any) {
      console.error('admin summary error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка сводки' });
    } finally {
      client.release();
    }
  });

  router.get('/tables/:table', async (req, res) => {
    const client = await pool.connect();
    try {
      await ensureBase(client);
      const key = String(req.params.table);

      if (key === 'users') return await usersTable(client, req, res);
      if (key === 'suppliers') return await suppliersTable(client, req, res);
      if (key === 'products') return await productsTable(client, req, res);

      return await genericTable(client, req, res, key);
    } catch (error: any) {
      console.error('admin table error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка таблицы' });
    } finally {
      client.release();
    }
  });

  router.get('/suppliers', async (req, res) => {
    const client = await pool.connect();
    try {
      return await suppliersTable(client, req, res);
    } catch (error: any) {
      console.error('admin suppliers error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка поставщиков' });
    } finally {
      client.release();
    }
  });

  router.post('/users', async (req, res) => {
    const client = await pool.connect();

    try {
      const { username, email, password, roleId } = req.body;

      if (!username || !email || !password || !roleId) {
        return res.status(400).json({ success: false, message: 'username, email, password, roleId обязательны' });
      }

      if (![1, 4, 5].includes(Number(roleId))) {
        return res.status(400).json({ success: false, message: 'Можно создать только администратора, модератора или регулятора' });
      }

      await client.query('BEGIN');
      await ensureBase(client);

      const exists = await client.query(
        `SELECT id FROM public.users WHERE LOWER("userName") = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1`,
        [username, email]
      );

      if (exists.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'Пользователь уже существует' });
      }

      const hash = await bcrypt.hash(password, 10);

      const created = await client.query(
        `
        INSERT INTO public.users ("userName", email, password, "roleId", "isActive")
        VALUES ($1, $2, $3, $4, true)
        RETURNING id, "userName" AS username, email, "roleId"
        `,
        [username, email, hash, Number(roleId)]
      );

      await client.query('COMMIT');

      return res.status(201).json({ success: true, user: created.rows[0] });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('admin create user error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка создания пользователя' });
    } finally {
      client.release();
    }
  });

  router.put('/users/:id/status', async (req, res) => {
    const client = await pool.connect();
    try {
      await ensureBase(client);
      await client.query(
        `UPDATE public.users SET "isActive" = $1 WHERE id = $2`,
        [Boolean(req.body.isActive), Number(req.params.id)]
      );
      return res.json({ success: true });
    } catch (error: any) {
      console.error('admin user status error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка статуса' });
    } finally {
      client.release();
    }
  });

  return router;
}
