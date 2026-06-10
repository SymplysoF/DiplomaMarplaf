import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { columnExists, like, pagination } from '../utils/dbSchema';

type Middleware = (req: Request, res: Response, next: any) => any;

interface Deps {
  pool: Pool;
  authenticateToken: Middleware;
  requireRole: (roleId: number) => Middleware;
}

export default function createAdminSuppliersFixedRouter({ pool, authenticateToken, requireRole }: Deps) {
  const router = Router();

  router.use(authenticateToken, requireRole(1));

  router.get('/suppliers', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
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
            SELECT COUNT(*)::int FROM public."supplierPlaces" sp WHERE sp."idSupplier" = s.id
          ) AS "placesCount"
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
        pagination: { page, limit, total: count.rows[0].total, pages: Math.max(1, Math.ceil(count.rows[0].total / limit)) }
      });
    } catch (error: any) {
      console.error('Error fetching suppliers:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка поставщиков' });
    } finally {
      client.release();
    }
  });

  router.post('/suppliers', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
      const { name, description, username, email, password } = req.body;

      if (!name || !username || !email || !password) {
        return res.status(400).json({ success: false, message: 'name, username, email, password обязательны' });
      }

      await client.query('BEGIN');

      const exists = await client.query(
        `SELECT id FROM public.users WHERE LOWER("userName") = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1`,
        [username, email]
      );

      if (exists.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'Пользователь уже существует' });
      }

      const hash = await bcrypt.hash(password, 10);

      const user = await client.query(
        `INSERT INTO public.users ("userName", email, password, "roleId") VALUES ($1, $2, $3, 2) RETURNING id`,
        [username, email, hash]
      );

      const hasDescription = await columnExists(client, 'suppliers', 'description');

      const supplier = hasDescription
        ? await client.query(`INSERT INTO public.suppliers (name, "userId", description) VALUES ($1, $2, $3) RETURNING *`, [name, user.rows[0].id, description || ''])
        : await client.query(`INSERT INTO public.suppliers (name, "userId") VALUES ($1, $2) RETURNING *`, [name, user.rows[0].id]);

      await client.query('COMMIT');

      return res.status(201).json({ success: true, supplier: supplier.rows[0] });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Error creating supplier:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка создания поставщика' });
    } finally {
      client.release();
    }
  });

  return router;
}
