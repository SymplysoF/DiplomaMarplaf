import { Router, Request, Response } from 'express';
import { Pool, PoolClient } from 'pg';
import { firstExistingTable, like, pagination, qt, safeCount } from '../../utils/dbSchema';

type Middleware = (req: Request, res: Response, next: any) => any;

interface Deps {
  pool: Pool;
  authenticateToken: Middleware;
}

function requireManagerOrAdmin(req: Request, res: Response, next: any) {
  const roleId = Number((req as any).user?.roleId);
  if (![1, 4].includes(roleId)) {
    return res.status(403).json({ success: false, message: 'Доступ только для администратора или модератора' });
  }
  return next();
}

async function ensureManagerTables(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public."moderationCards" (
      id serial PRIMARY KEY,
      "idProduct" integer NOT NULL,
      status varchar(30) NOT NULL DEFAULT 'pending',
      comment text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_moderation_cards_product
    ON public."moderationCards" ("idProduct")
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public."moderationHistory" (
      id serial PRIMARY KEY,
      "idModerationCard" integer,
      "idProduct" integer,
      "moderatorUserId" integer,
      decision varchar(30) NOT NULL,
      comment text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public."managerUserReviews" (
      id serial PRIMARY KEY,
      "userId" integer NOT NULL,
      status varchar(30) NOT NULL DEFAULT 'pending',
      comment text,
      "reviewedBy" integer,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_manager_user_reviews_user
    ON public."managerUserReviews" ("userId")
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public."managerAppeals" (
      id serial PRIMARY KEY,
      "userId" integer,
      subject varchar(255) NOT NULL,
      message text,
      status varchar(30) NOT NULL DEFAULT 'open',
      answer text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.certificates (
      id serial PRIMARY KEY,
      title varchar(255) NOT NULL,
      description text,
      status varchar(30) NOT NULL DEFAULT 'pending',
      "fileUrl" text,
      "supplierId" integer,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    INSERT INTO public."moderationCards" ("idProduct", status, comment)
    SELECT p.id, 'pending', 'Автоматически добавлено для модерации'
    FROM public.products p
    WHERE NOT EXISTS (SELECT 1 FROM public."moderationCards" mc WHERE mc."idProduct" = p.id)
    ORDER BY p.id DESC
    LIMIT 50
    ON CONFLICT DO NOTHING
  `);

  await client.query(`
    INSERT INTO public."managerUserReviews" ("userId", status, comment)
    SELECT u.id, 'pending', 'Проверить профиль пользователя'
    FROM public.users u
    WHERE u."roleId" IN (2, 3)
      AND NOT EXISTS (SELECT 1 FROM public."managerUserReviews" mur WHERE mur."userId" = u.id)
    ORDER BY u.id DESC
    LIMIT 50
    ON CONFLICT DO NOTHING
  `);
}

function priceExpr() {
  return `COALESCE(pc."wholePart", 0)::numeric + COALESCE(pc.copecks, 0)::numeric / 100.0`;
}

async function productImageExpr(client: PoolClient) {
  const table = await firstExistingTable(client, ['productImages', 'imagesProducts']);
  if (!table) return 'NULL';

  return `(
    SELECT COALESCE(pi.url, pi.path, pi."imageUrl", pi.filename)
    FROM ${qt(table)} pi
    WHERE pi."idProduct" = p.id
    LIMIT 1
  )`;
}

export default function createManagerRouter({ pool, authenticateToken }: Deps) {
  const router = Router();

  router.use(authenticateToken, requireManagerOrAdmin);

  router.get('/overview', async (_req, res) => {
    const client = await pool.connect();
    try {
      await ensureManagerTables(client);

      return res.json({
        success: true,
        summary: {
          pendingCards: await safeCount(client, 'moderationCards', `status = 'pending'`),
          revisionCards: await safeCount(client, 'moderationCards', `status = 'revision'`),
          approvedCards: await safeCount(client, 'moderationCards', `status = 'approved'`),
          pendingUsers: await safeCount(client, 'managerUserReviews', `status = 'pending'`),
          certificates: await safeCount(client, 'certificates'),
          openAppeals: await safeCount(client, 'managerAppeals', `status <> 'closed'`)
        }
      });
    } catch (error: any) {
      console.error('manager overview error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка обзора менеджера' });
    } finally {
      client.release();
    }
  });

  router.get('/moderation/cards', async (req, res) => {
    const client = await pool.connect();
    try {
      await ensureManagerTables(client);

      const { page, limit, offset } = pagination(req.query, 50);
      const status = String(req.query.status || 'pending');
      const search = String(req.query.search || '');

      const params: any[] = [];
      const whereParts: string[] = [];

      if (status !== 'all') {
        params.push(status);
        whereParts.push(`mc.status = $${params.length}`);
      }

      if (search) {
        params.push(like(search));
        whereParts.push(`(
          LOWER(COALESCE(p.name, '')) LIKE $${params.length}
          OR LOWER(COALESCE(no.name, '')) LIKE $${params.length}
          OR LOWER(COALESCE(s.name, '')) LIKE $${params.length}
        )`);
      }

      const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
      const img = await productImageExpr(client);

      const count = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM public."moderationCards" mc
        JOIN public.products p ON p.id = mc."idProduct"
        LEFT JOIN public."namesObjects" no ON no.id = p."idObject"
        LEFT JOIN public."supplierPlacesProducts" spp ON spp."idProduct" = p.id
        LEFT JOIN public."supplierPlaces" sp ON sp.id = spp."idSupplierPlace"
        LEFT JOIN public.suppliers s ON s.id = sp."idSupplier"
        ${where}
        `,
        params
      );

      const rows = await client.query(
        `
        SELECT
          mc.id,
          mc."idProduct" AS "productId",
          mc.status,
          mc.comment,
          mc."createdAt",
          mc."updatedAt",
          p.name AS "productName",
          no.name AS "cultureName",
          no."idVariety" AS "varietyId",
          s.id AS "supplierId",
          s.name AS "supplierName",
          fr.name AS "freshnessName",
          ${priceExpr()} AS price,
          ${img} AS "imageUrl"
        FROM public."moderationCards" mc
        JOIN public.products p ON p.id = mc."idProduct"
        LEFT JOIN public."namesObjects" no ON no.id = p."idObject"
        LEFT JOIN public."productCopies" pc ON pc."idProduct" = p.id
        LEFT JOIN public.freshness fr ON fr.id = pc."idFreshness"
        LEFT JOIN public."supplierPlacesProducts" spp ON spp."idProduct" = p.id
        LEFT JOIN public."supplierPlaces" sp ON sp.id = spp."idSupplierPlace"
        LEFT JOIN public.suppliers s ON s.id = sp."idSupplier"
        ${where}
        ORDER BY mc."updatedAt" DESC, mc.id DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
        `,
        [...params, limit, offset]
      );

      return res.json({
        success: true,
        cards: rows.rows,
        pagination: { page, limit, total: count.rows[0].total, pages: Math.max(1, Math.ceil(count.rows[0].total / limit)) }
      });
    } catch (error: any) {
      console.error('manager cards error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка карточек' });
    } finally {
      client.release();
    }
  });

  router.get('/moderation/cards/:id', async (req, res) => {
    const client = await pool.connect();
    try {
      await ensureManagerTables(client);

      const id = Number(req.params.id);
      const img = await productImageExpr(client);

      const result = await client.query(
        `
        SELECT
          mc.id,
          mc."idProduct" AS "productId",
          mc.status,
          mc.comment,
          mc."createdAt",
          p.name AS "productName",
          no.name AS "cultureName",
          no."idVariety" AS "varietyId",
          s.id AS "supplierId",
          s.name AS "supplierName",
          u."userName" AS "supplierLogin",
          u.email AS "supplierEmail",
          fr.name AS "freshnessName",
          pc.weight,
          pc.proteines,
          pc.lipides,
          pc.glucides,
          pc.calories,
          pc.joules,
          ${priceExpr()} AS price,
          ${img} AS "imageUrl"
        FROM public."moderationCards" mc
        JOIN public.products p ON p.id = mc."idProduct"
        LEFT JOIN public."namesObjects" no ON no.id = p."idObject"
        LEFT JOIN public."productCopies" pc ON pc."idProduct" = p.id
        LEFT JOIN public.freshness fr ON fr.id = pc."idFreshness"
        LEFT JOIN public."supplierPlacesProducts" spp ON spp."idProduct" = p.id
        LEFT JOIN public."supplierPlaces" sp ON sp.id = spp."idSupplierPlace"
        LEFT JOIN public.suppliers s ON s.id = sp."idSupplier"
        LEFT JOIN public.users u ON u.id = s."userId"
        WHERE mc.id = $1
        LIMIT 1
        `,
        [id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Карточка не найдена' });
      }

      const history = await client.query(
        `
        SELECT h.id, h.decision, h.comment, h."createdAt", u."userName" AS "moderatorName"
        FROM public."moderationHistory" h
        LEFT JOIN public.users u ON u.id = h."moderatorUserId"
        WHERE h."idModerationCard" = $1
        ORDER BY h."createdAt" DESC
        `,
        [id]
      );

      const certificates = await client.query(
        `
        SELECT id, title, description, status, "fileUrl", "createdAt"
        FROM public.certificates
        WHERE "supplierId" = $1 OR "supplierId" IS NULL
        ORDER BY id DESC
        LIMIT 20
        `,
        [result.rows[0].supplierId]
      ).catch(() => ({ rows: [] } as any));

      return res.json({
        success: true,
        card: { ...result.rows[0], history: history.rows, documents: certificates.rows }
      });
    } catch (error: any) {
      console.error('manager card detail error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка карточки' });
    } finally {
      client.release();
    }
  });

  router.post('/moderation/cards/:id/decision', async (req, res) => {
    const client = await pool.connect();
    try {
      await ensureManagerTables(client);

      const id = Number(req.params.id);
      const moderatorUserId = Number((req as any).user?.userId);
      const { decision, comment } = req.body;

      if (!['approved', 'rejected', 'revision'].includes(decision)) {
        return res.status(400).json({ success: false, message: 'Некорректное решение' });
      }

      await client.query('BEGIN');

      const card = await client.query(
        `SELECT id, "idProduct" AS "idProduct" FROM public."moderationCards" WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (!card.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Карточка не найдена' });
      }

      await client.query(
        `UPDATE public."moderationCards" SET status = $1, comment = $2, "updatedAt" = now() WHERE id = $3`,
        [decision, comment || '', id]
      );

      await client.query(
        `
        INSERT INTO public."moderationHistory"
          ("idModerationCard", "idProduct", "moderatorUserId", decision, comment)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [id, card.rows[0].idProduct, moderatorUserId || null, decision, comment || '']
      );

      await client.query('COMMIT');

      return res.json({ success: true });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('manager decision error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка решения' });
    } finally {
      client.release();
    }
  });

  router.get('/moderation/history', async (req, res) => {
    const client = await pool.connect();
    try {
      await ensureManagerTables(client);

      const { page, limit, offset } = pagination(req.query, 100);
      const count = await client.query(`SELECT COUNT(*)::int AS total FROM public."moderationHistory"`);

      const rows = await client.query(
        `
        SELECT
          h.id,
          h."idModerationCard" AS "cardId",
          h."idProduct" AS "productId",
          p.name AS "productName",
          h.decision,
          h.comment,
          h."createdAt",
          u."userName" AS "moderatorName",
          u.email AS "moderatorEmail"
        FROM public."moderationHistory" h
        LEFT JOIN public.products p ON p.id = h."idProduct"
        LEFT JOIN public.users u ON u.id = h."moderatorUserId"
        ORDER BY h."createdAt" DESC
        LIMIT $1 OFFSET $2
        `,
        [limit, offset]
      );

      return res.json({
        success: true,
        history: rows.rows,
        pagination: { page, limit, total: count.rows[0].total, pages: Math.max(1, Math.ceil(count.rows[0].total / limit)) }
      });
    } catch (error: any) {
      console.error('manager history error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка истории' });
    } finally {
      client.release();
    }
  });

  router.get('/users', async (req, res) => {
    const client = await pool.connect();
    try {
      await ensureManagerTables(client);

      const { page, limit, offset } = pagination(req.query, 100);
      const status = String(req.query.status || 'all');
      const search = String(req.query.search || '');
      const params: any[] = [];
      const whereParts: string[] = [];

      if (status !== 'all') {
        params.push(status);
        whereParts.push(`mur.status = $${params.length}`);
      }

      if (search) {
        params.push(like(search));
        whereParts.push(`(LOWER(u."userName") LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`);
      }

      const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

      const count = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM public."managerUserReviews" mur
        JOIN public.users u ON u.id = mur."userId"
        ${where}
        `,
        params
      );

      const rows = await client.query(
        `
        SELECT
          mur.id,
          mur.status AS "reviewStatus",
          mur.comment,
          mur."createdAt",
          mur."updatedAt",
          u.id AS "userId",
          u."userName" AS username,
          u.email,
          u."roleId",
          COALESCE(r.name, 'Пользователь') AS "roleName"
        FROM public."managerUserReviews" mur
        JOIN public.users u ON u.id = mur."userId"
        LEFT JOIN public.roles r ON r.id = u."roleId"
        ${where}
        ORDER BY mur."updatedAt" DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
        `,
        [...params, limit, offset]
      );

      return res.json({
        success: true,
        users: rows.rows,
        pagination: { page, limit, total: count.rows[0].total, pages: Math.max(1, Math.ceil(count.rows[0].total / limit)) }
      });
    } catch (error: any) {
      console.error('manager users error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка пользователей' });
    } finally {
      client.release();
    }
  });

  router.post('/users/:id/decision', async (req, res) => {
    const client = await pool.connect();
    try {
      await ensureManagerTables(client);

      const id = Number(req.params.id);
      const reviewerId = Number((req as any).user?.userId);
      const { decision, comment } = req.body;

      if (!['verified', 'rejected', 'revision'].includes(decision)) {
        return res.status(400).json({ success: false, message: 'Некорректное решение' });
      }

      await client.query(
        `
        UPDATE public."managerUserReviews"
        SET status = $1, comment = $2, "reviewedBy" = $3, "updatedAt" = now()
        WHERE id = $4
        `,
        [decision, comment || '', reviewerId || null, id]
      );

      return res.json({ success: true });
    } catch (error: any) {
      console.error('manager user decision error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка проверки пользователя' });
    } finally {
      client.release();
    }
  });

  router.get('/certificates', async (req, res) => {
    const client = await pool.connect();
    try {
      await ensureManagerTables(client);

      const { page, limit, offset } = pagination(req.query, 100);
      const search = String(req.query.search || '');
      const params: any[] = [];
      let where = '';

      if (search) {
        params.push(like(search));
        where = `WHERE LOWER(COALESCE(c.title, '')) LIKE $1 OR LOWER(COALESCE(c.description, '')) LIKE $1`;
      }

      const count = await client.query(`SELECT COUNT(*)::int AS total FROM public.certificates c ${where}`, params);

      const rows = await client.query(
        `
        SELECT
          c.id, c.title, c.description, c.status, c."fileUrl", c."supplierId", c."createdAt",
          s.name AS "supplierName"
        FROM public.certificates c
        LEFT JOIN public.suppliers s ON s.id = c."supplierId"
        ${where}
        ORDER BY c.id DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
        `,
        [...params, limit, offset]
      );

      return res.json({
        success: true,
        certificates: rows.rows,
        pagination: { page, limit, total: count.rows[0].total, pages: Math.max(1, Math.ceil(count.rows[0].total / limit)) }
      });
    } catch (error: any) {
      console.error('manager certificates error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка сертификатов' });
    } finally {
      client.release();
    }
  });

  router.get('/appeals', async (req, res) => {
    const client = await pool.connect();
    try {
      await ensureManagerTables(client);

      const { page, limit, offset } = pagination(req.query, 100);
      const status = String(req.query.status || 'open');
      const search = String(req.query.search || '');
      const params: any[] = [];
      const whereParts: string[] = [];

      if (status !== 'all') {
        params.push(status);
        whereParts.push(`ma.status = $${params.length}`);
      }

      if (search) {
        params.push(like(search));
        whereParts.push(`(LOWER(ma.subject) LIKE $${params.length} OR LOWER(COALESCE(ma.message, '')) LIKE $${params.length})`);
      }

      const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

      const count = await client.query(`SELECT COUNT(*)::int AS total FROM public."managerAppeals" ma ${where}`, params);

      const rows = await client.query(
        `
        SELECT ma.id, ma.subject, ma.message, ma.status, ma.answer, ma."createdAt", ma."updatedAt",
               u."userName" AS username, u.email
        FROM public."managerAppeals" ma
        LEFT JOIN public.users u ON u.id = ma."userId"
        ${where}
        ORDER BY ma."createdAt" DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
        `,
        [...params, limit, offset]
      );

      return res.json({
        success: true,
        appeals: rows.rows,
        pagination: { page, limit, total: count.rows[0].total, pages: Math.max(1, Math.ceil(count.rows[0].total / limit)) }
      });
    } catch (error: any) {
      console.error('manager appeals error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка обращений' });
    } finally {
      client.release();
    }
  });

  router.put('/appeals/:id', async (req, res) => {
    const client = await pool.connect();
    try {
      await ensureManagerTables(client);
      await client.query(
        `UPDATE public."managerAppeals" SET status = $1, answer = $2, "updatedAt" = now() WHERE id = $3`,
        [req.body.status || 'in_progress', req.body.answer || '', Number(req.params.id)]
      );
      return res.json({ success: true });
    } catch (error: any) {
      console.error('manager appeal update error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка обращения' });
    } finally {
      client.release();
    }
  });

  return router;
}
