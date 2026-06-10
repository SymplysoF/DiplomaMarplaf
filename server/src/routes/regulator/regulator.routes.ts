import { Router, Request, Response } from 'express';
import { Pool, PoolClient } from 'pg';
import { firstExistingColumn, firstExistingTable, q } from '../../utils/dbSchema';

type Middleware = (req: Request, res: Response, next: any) => any;

interface Deps {
  pool: Pool;
  authenticateToken: Middleware;
}

function requireRegulatorOrAdmin(req: Request, res: Response, next: any) {
  const roleId = Number((req as any).user?.roleId);
  if (![1, 5].includes(roleId)) {
    return res.status(403).json({ success: false, message: 'Доступ только для администратора или регулятора' });
  }
  return next();
}

async function getPlaceRegionExpr(client: PoolClient) {
  const placeTable = await firstExistingTable(client, ['places', 'place']);
  if (!placeTable) return { join: '', expr: `'Не указан'::text`, table: null };

  const regionCol = await firstExistingColumn(client, placeTable, ['region', 'city', 'address', 'name', 'title']);
  if (!regionCol) return { join: '', expr: `'Не указан'::text`, table: placeTable };

  return {
    table: placeTable,
    expr: `COALESCE(pl.${q(regionCol)}::text, 'Не указан')`,
    join: `
      LEFT JOIN public."supplierPlacesProducts" spp ON spp."idProduct" = p.id
      LEFT JOIN public."supplierPlaces" sp ON sp.id = spp."idSupplierPlace"
      LEFT JOIN public.${q(placeTable)} pl ON pl.id = sp."idPlace"
    `
  };
}

export default function createRegulatorRouter({ pool, authenticateToken }: Deps) {
  const router = Router();

  router.use(authenticateToken, requireRegulatorOrAdmin);

  router.get('/filters', async (_req, res) => {
    const client = await pool.connect();

    try {
      const cultures = await client.query(
        `
        SELECT DISTINCT name
        FROM public."namesObjects"
        WHERE name IS NOT NULL
        ORDER BY name
        `
      ).catch(() => ({ rows: [] } as any));

      const region = await getPlaceRegionExpr(client);

      let regions: any = { rows: [] };
      if (region.join) {
        regions = await client.query(
          `
          SELECT DISTINCT ${region.expr} AS region
          FROM public.products p
          ${region.join}
          ORDER BY region
          `
        ).catch(() => ({ rows: [] } as any));
      }

      return res.json({
        success: true,
        filters: {
          cultures: cultures.rows.map((r: any) => r.name).filter(Boolean),
          regions: regions.rows.map((r: any) => r.region).filter(Boolean),
          statuses: ['actual', 'not_actual', 'sold', 'auction', 'pending']
        }
      });
    } catch (error: any) {
      console.error('regulator filters error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка фильтров' });
    } finally {
      client.release();
    }
  });

  router.get('/dashboard', async (req, res) => {
    const client = await pool.connect();

    try {
      const culture = String(req.query.culture || '');
      const regionFilter = String(req.query.region || '');
      const status = String(req.query.status || '');

      const region = await getPlaceRegionExpr(client);

      const params: any[] = [];
      const whereParts = ['TRUE'];

      if (culture) {
        params.push(culture);
        whereParts.push(`LOWER(no.name) = LOWER($${params.length})`);
      }

      if (regionFilter && region.join) {
        params.push(regionFilter);
        whereParts.push(`LOWER(${region.expr}) = LOWER($${params.length})`);
      }

      if (status === 'actual') whereParts.push(`COALESCE(pc."isActual", true) = true`);
      if (status === 'not_actual') whereParts.push(`COALESCE(pc."isActual", true) = false`);

      const where = `WHERE ${whereParts.join(' AND ')}`;

      const summary = await client.query(
        `
        SELECT
          COUNT(DISTINCT p.id)::int AS products,
          COALESCE(SUM(COALESCE(pc.weight, 0)), 0)::numeric AS stock,
          COALESCE(AVG(NULLIF(COALESCE(pc."wholePart", 0)::numeric + COALESCE(pc.copecks, 0)::numeric / 100.0, 0)), 0)::numeric AS avg_price
        FROM public.products p
        LEFT JOIN public."namesObjects" no ON no.id = p."idObject"
        LEFT JOIN public."productCopies" pc ON pc."idProduct" = p.id
        ${region.join}
        ${where}
        `,
        params
      ).catch(() => ({ rows: [{ products: 0, stock: 0, avg_price: 0 }] } as any));

      const purchases = await client.query(
        `SELECT COALESCE(SUM(quantity), 0)::numeric AS quantity FROM public.purchases`
      ).catch(() => ({ rows: [{ quantity: 0 }] } as any));

      const byCulture = await client.query(
        `
        SELECT
          COALESCE(no.name, 'Не указано') AS culture,
          COUNT(DISTINCT p.id)::int AS count,
          COALESCE(SUM(COALESCE(pc.weight, 0)), 0)::numeric AS volume,
          COALESCE(AVG(NULLIF(COALESCE(pc."wholePart", 0)::numeric + COALESCE(pc.copecks, 0)::numeric / 100.0, 0)), 0)::numeric AS avg_price
        FROM public.products p
        LEFT JOIN public."namesObjects" no ON no.id = p."idObject"
        LEFT JOIN public."productCopies" pc ON pc."idProduct" = p.id
        ${region.join}
        ${where}
        GROUP BY COALESCE(no.name, 'Не указано')
        ORDER BY volume DESC, count DESC
        LIMIT 12
        `,
        params
      ).catch(() => ({ rows: [] } as any));

      let byRegion: any = { rows: [] };
      if (region.join) {
        byRegion = await client.query(
          `
          SELECT
            ${region.expr} AS region,
            COUNT(DISTINCT p.id)::int AS count,
            COALESCE(SUM(COALESCE(pc.weight, 0)), 0)::numeric AS volume
          FROM public.products p
          LEFT JOIN public."namesObjects" no ON no.id = p."idObject"
          LEFT JOIN public."productCopies" pc ON pc."idProduct" = p.id
          ${region.join}
          ${where}
          GROUP BY ${region.expr}
          ORDER BY volume DESC, count DESC
          LIMIT 12
          `,
          params
        ).catch(() => ({ rows: [] } as any));
      }

      const totalCulture = byCulture.rows.reduce((s: number, r: any) => s + Number(r.volume || 0), 0) || 1;
      const totalRegion = byRegion.rows.reduce((s: number, r: any) => s + Number(r.volume || 0), 0) || 1;
      const s = summary.rows[0] || {};

      const risks = [];
      if (Number(s.stock || 0) < 100) {
        risks.push({
          type: 'deficit',
          title: 'Риск дефицита',
          message: 'Совокупный остаток продукции ниже пилотного контрольного порога 100 кг.'
        });
      }

      if (Number(s.avg_price || 0) > 500) {
        risks.push({
          type: 'price',
          title: 'Высокая средняя цена',
          message: 'Средний ценовой показатель выше пилотного порога.'
        });
      }

      return res.json({
        success: true,
        summary: {
          offerVolume: Number(s.stock || 0),
          salesVolume: Number(purchases.rows[0]?.quantity || 0),
          stockVolume: Number(s.stock || 0),
          avgPrice: Number(s.avg_price || 0),
          products: Number(s.products || 0)
        },
        byCulture: byCulture.rows.map((r: any) => ({ ...r, percent: Number(r.volume || 0) / totalCulture * 100 })),
        byRegion: byRegion.rows.map((r: any) => ({ ...r, percent: Number(r.volume || 0) / totalRegion * 100 })),
        risks
      });
    } catch (error: any) {
      console.error('regulator dashboard error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Ошибка панели регулятора' });
    } finally {
      client.release();
    }
  });

  return router;
}
