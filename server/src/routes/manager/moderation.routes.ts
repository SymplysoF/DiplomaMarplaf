import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { Pool } from 'pg';

type RouteDeps = {
  pool: Pool;
  authenticateToken: RequestHandler;
};

const requireAnyRole = (roles: number[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const roleId = Number((req as any).user?.roleId ?? (req as any).user?.roleID ?? 0);

    if (!roles.includes(roleId)) {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав'
      });
    }

    next();
  };
};

const toInt = (value: any, fallback: number) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const safeRows = async (pool: Pool, sql: string, params: any[] = []) => {
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error: any) {
    if (error?.code === '42P01' || error?.code === '42703') {
      console.warn('Optional moderation query skipped:', error.message);
      return [];
    }
    throw error;
  }
};

export default function createManagerModerationRouter({ pool, authenticateToken }: RouteDeps) {
  const router = Router();

  router.use(authenticateToken);
  router.use(requireAnyRole([1, 4]));

  router.get('/moderation/summary', async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
          COUNT(*) FILTER (WHERE status = 'needs_revision')::int AS needs_revision,
          COUNT(*)::int AS total
        FROM public."moderationCards"
      `);

      return res.json({ success: true, summary: result.rows[0] });
    } catch (error: any) {
      console.error('manager moderation summary error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка сервера' });
    }
  });

  router.get('/moderation/cards', async (req: Request, res: Response) => {
    try {
      const page = toInt(req.query.page, 1);
      const limit = Math.min(toInt(req.query.limit, 12), 100);
      const offset = (page - 1) * limit;
      const q = String(req.query.q || '').trim();
      const status = String(req.query.status || '').trim();

      const params: any[] = [];
      const where: string[] = [];

      if (status) {
        params.push(status);
        where.push(`mc.status = $${params.length}`);
      }

      if (q) {
        params.push(`%${q.toLowerCase()}%`);
        where.push(`(
          LOWER(p.name) LIKE $${params.length}
          OR LOWER(COALESCE(no.name, '')) LIKE $${params.length}
          OR LOWER(COALESCE(v.name, '')) LIKE $${params.length}
          OR LOWER(COALESCE(s.name, '')) LIKE $${params.length}
          OR LOWER(COALESCE(u.email, '')) LIKE $${params.length}
        )`);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const totalResult = await pool.query(`
        SELECT COUNT(DISTINCT p.id)::int AS total
        FROM public.products p
        JOIN public."moderationCards" mc ON mc."idProduct" = p.id
        LEFT JOIN public."namesObjects" no ON no.id = p."idObject"
        LEFT JOIN public.varieties v ON v.id = no."idVariety"
        LEFT JOIN public."supplierPlacesProducts" spp ON spp."idProduct" = p.id
        LEFT JOIN public."supplierPlaces" sp ON sp.id = spp."idSupplierPlace"
        LEFT JOIN public.suppliers s ON s.id = sp."idSupplier"
        LEFT JOIN public.users u ON u.id = s."userId"
        ${whereSql}
      `, params);

      params.push(limit, offset);

      const cards = await pool.query(`
        SELECT DISTINCT ON (p.id)
          p.id AS "productId",
          p.name AS "productName",
          mc.status,
          mc."lastComment",
          mc."createdAt",
          mc."updatedAt",
          no.name AS "objectName",
          v.name AS "varietyName",
          f.name AS "freshnessName",
          s.id AS "supplierId",
          s.name AS "supplierName",
          u.email AS "supplierEmail",
          pl.address AS "placeAddress",
          (pc."wholePart" + COALESCE(pc.copecks, 0)::numeric / 100) AS price,
          NULL::text AS "imageUrl"
        FROM public.products p
        JOIN public."moderationCards" mc ON mc."idProduct" = p.id
        LEFT JOIN public."productCopies" pc ON pc."idProduct" = p.id
        LEFT JOIN public.freshness f ON f.id = pc."idFreshness"
        LEFT JOIN public."namesObjects" no ON no.id = p."idObject"
        LEFT JOIN public.varieties v ON v.id = no."idVariety"
        LEFT JOIN public."supplierPlacesProducts" spp ON spp."idProduct" = p.id
        LEFT JOIN public."supplierPlaces" sp ON sp.id = spp."idSupplierPlace"
        LEFT JOIN public.places pl ON pl.id = sp."idPlace"
        LEFT JOIN public.suppliers s ON s.id = sp."idSupplier"
        LEFT JOIN public.users u ON u.id = s."userId"
        ${whereSql}
        ORDER BY p.id DESC, mc."updatedAt" DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params);

      return res.json({
        success: true,
        cards: cards.rows,
        pagination: {
          page,
          limit,
          total: totalResult.rows[0]?.total || 0,
          pages: Math.ceil((totalResult.rows[0]?.total || 0) / limit)
        }
      });
    } catch (error: any) {
      console.error('manager moderation cards error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка сервера' });
    }
  });

  router.get('/moderation/cards/:productId', async (req: Request, res: Response) => {
    try {
      const productId = Number(req.params.productId);

      const result = await pool.query(`
        SELECT DISTINCT ON (p.id)
          p.id AS "productId",
          p.name AS "productName",
          mc.status,
          mc."lastComment",
          mc."createdAt",
          mc."updatedAt",
          no.name AS "objectName",
          v.name AS "varietyName",
          f.name AS "freshnessName",
          s.id AS "supplierId",
          s.name AS "supplierName",
          s.description AS "supplierDescription",
          u.email AS "supplierEmail",
          pl.address AS "placeAddress",
          (pc."wholePart" + COALESCE(pc.copecks, 0)::numeric / 100) AS price,
          pc.decsription AS description,
          pc.proteines,
          pc.lipides,
          pc.glucides,
          pc.calories,
          pc.joules
        FROM public.products p
        JOIN public."moderationCards" mc ON mc."idProduct" = p.id
        LEFT JOIN public."productCopies" pc ON pc."idProduct" = p.id
        LEFT JOIN public.freshness f ON f.id = pc."idFreshness"
        LEFT JOIN public."namesObjects" no ON no.id = p."idObject"
        LEFT JOIN public.variety v ON v.id = no."idVariety"
        LEFT JOIN public."supplierPlacesProducts" spp ON spp."idProduct" = p.id
        LEFT JOIN public."supplierPlaces" sp ON sp.id = spp."idSupplierPlace"
        LEFT JOIN public.places pl ON pl.id = sp."idPlace"
        LEFT JOIN public.suppliers s ON s.id = sp."idSupplier"
        LEFT JOIN public.users u ON u.id = s."userId"
        WHERE p.id = $1
        ORDER BY p.id DESC
      `, [productId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Карточка не найдена' });
      }

      const images = await safeRows(pool, `
        SELECT id, url, "createdAt"
        FROM public."productImages"
        WHERE "idProduct" = $1
        ORDER BY id DESC
      `, [productId]);

      const documents = await safeRows(pool, `
        SELECT id, title, type, url, "createdAt"
        FROM public.certificates
        WHERE "idProduct" = $1
        ORDER BY id DESC
      `, [productId]);

      const history = await safeRows(pool, `
        SELECT
          mh.id,
          mh.decision,
          mh.comment,
          mh."createdAt",
          COALESCE(u."userName", u.login, u.email) AS "moderatorName"
        FROM public."moderationHistory" mh
        LEFT JOIN public.users u ON u.id = mh."moderatorUserId"
        WHERE mh."idProduct" = $1
        ORDER BY mh."createdAt" DESC
      `, [productId]);

      return res.json({
        success: true,
        card: {
          ...result.rows[0],
          images,
          documents,
          history
        }
      });
    } catch (error: any) {
      console.error('manager moderation card details error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка сервера' });
    }
  });

  router.post('/moderation/cards/:productId/decision', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
      const productId = Number(req.params.productId);
      const moderatorUserId = Number((req as any).user?.userId || (req as any).user?.id || 0);
      const { decision, comment } = req.body as { decision: string; comment?: string };

      const allowed = ['approved', 'rejected', 'needs_revision'];
      if (!allowed.includes(decision)) {
        return res.status(400).json({ success: false, message: 'Некорректное решение' });
      }

      if ((decision === 'rejected' || decision === 'needs_revision') && !String(comment || '').trim()) {
        return res.status(400).json({ success: false, message: 'Нужен комментарий' });
      }

      await client.query('BEGIN');

      await client.query(`
        INSERT INTO public."moderationCards" ("idProduct", status, "lastComment", "lastModeratorUserId", "updatedAt")
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT ("idProduct")
        DO UPDATE SET
          status = EXCLUDED.status,
          "lastComment" = EXCLUDED."lastComment",
          "lastModeratorUserId" = EXCLUDED."lastModeratorUserId",
          "updatedAt" = NOW()
      `, [productId, decision, comment || null, moderatorUserId || null]);

      await client.query(`
        INSERT INTO public."moderationHistory" ("idProduct", "moderatorUserId", decision, comment)
        VALUES ($1, $2, $3, $4)
      `, [productId, moderatorUserId || null, decision, comment || null]);

      await client.query('COMMIT');

      return res.json({ success: true });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('manager moderation decision error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка сервера' });
    } finally {
      client.release();
    }
  });

  router.get('/moderation/history', async (req: Request, res: Response) => {
    try {
      const page = toInt(req.query.page, 1);
      const limit = Math.min(toInt(req.query.limit, 50), 100);
      const offset = (page - 1) * limit;
      const q = String(req.query.q || '').trim();

      const params: any[] = [];
      const where: string[] = [];

      if (q) {
        params.push(`%${q.toLowerCase()}%`);
        where.push(`(
          LOWER(p.name) LIKE $${params.length}
          OR LOWER(COALESCE(mh.comment, '')) LIKE $${params.length}
          OR LOWER(COALESCE(u.email, '')) LIKE $${params.length}
        )`);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const total = await pool.query(`
        SELECT COUNT(*)::int AS total
        FROM public."moderationHistory" mh
        LEFT JOIN public.products p ON p.id = mh."idProduct"
        LEFT JOIN public.users u ON u.id = mh."moderatorUserId"
        ${whereSql}
      `, params);

      params.push(limit, offset);

      const history = await pool.query(`
        SELECT
          mh.id,
          mh."idProduct" AS "productId",
          p.name AS "productName",
          mh.decision,
          mh.comment,
          mh."createdAt",
          COALESCE(u."userName", u.email) AS "moderatorName"
        FROM public."moderationHistory" mh
        LEFT JOIN public.products p ON p.id = mh."idProduct"
        LEFT JOIN public.users u ON u.id = mh."moderatorUserId"
        ${whereSql}
        ORDER BY mh."createdAt" DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params);

      return res.json({
        success: true,
        history: history.rows,
        pagination: {
          page,
          limit,
          total: total.rows[0]?.total || 0,
          pages: Math.ceil((total.rows[0]?.total || 0) / limit)
        }
      });
    } catch (error: any) {
      console.error('manager moderation history error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка сервера' });
    }
  });

  return router;
}
