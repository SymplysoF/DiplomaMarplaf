import { Router, Request, Response } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { ok, fail } from '../../utils/responses';

const router = Router();

router.get('/purchases', authenticateToken, requireRole(3), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const customerRes = await pool.query(
      `SELECT id, "deliveryAddress" FROM customers WHERE "idUser" = $1`,
      [userId]
    );

    if (customerRes.rows.length === 0) {
      return fail(res, 404, 'Покупатель не найден');
    }

    const customerId = customerRes.rows[0].id;

    const query = `
     SELECT
    pu.id,
    pu."idProduct",
    pu."idSupplier",
    pu."idPlace",
    pu.quantity,
    pu.status,
    pu."paymentMethod",
    pu."deliveryAddress",
    pu."contactPhone",
    pu."contactEmail",
    pu.comment,
    pu."createdAt",
    pu."updatedAt",
    pu."completedAt",
    pr.name AS "productName",
    s.name AS "supplierName",
    pl.address AS "placeAddress",
    COALESCE(pc."wholePart", 0) + COALESCE(pc.copecks, 0) / 100.0 AS "unitPrice",
    (COALESCE(pc."wholePart", 0) + COALESCE(pc.copecks, 0) / 100.0) * pu.quantity AS "totalPrice"
FROM purchases pu
LEFT JOIN products pr ON pu."idProduct" = pr.id
LEFT JOIN suppliers s ON pu."idSupplier" = s.id
LEFT JOIN places pl ON pu."idPlace" = pl.id
LEFT JOIN "productCopies" pc ON pc."idProduct" = pr.id AND pc."isActual" = true
WHERE pu."idCustomer" = $1
ORDER BY pu."createdAt" DESC
    `;

    const result = await pool.query(query, [customerId]);

    return ok(res, { purchases: result.rows });
  } catch (error) {
    console.error('buyer purchases get error', error);
    return fail(res, 500, 'Ошибка сервера');
  }
});

router.get('/purchases/:id', authenticateToken, requireRole(3), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const query = `
     SELECT
    pu.*,
    pr.name AS "productName",
    s.name AS "supplierName",
    pl.address AS "placeAddress"
FROM "Purchases" pu
JOIN "Customers" c ON pu."idCustomer" = c.id
LEFT JOIN "Products" pr ON pu."idProduct" = pr.id
LEFT JOIN "Suppliers" s ON pu."idSupplier" = s.id
LEFT JOIN "Places" pl ON pu."idPlace" = pl.id
WHERE pu.id = $1 AND c."idUser" = $2
    `;

    const result = await pool.query(query, [id, userId]);

    if (result.rows.length === 0) {
      return fail(res, 404, 'Покупка не найдена');
    }

    return ok(res, { purchase: result.rows[0] });
  } catch (error) {
    console.error('buyer purchase detail error', error);
    return fail(res, 500, 'Ошибка сервера');
  }
});

router.put('/purchases/:id', authenticateToken, requireRole(3), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;
    const { deliveryaddress, contactphone, contactemail, comment, paymentmethod } = req.body;

    const checkQuery = `
      SELECT pu.id
      FROM purchases pu
      JOIN customers c ON pu.idcustomer = c.id
      WHERE pu.id = $1 AND c.iduser = $2 AND pu.status = 'pending'
    `;

    const check = await pool.query(checkQuery, [id, userId]);

    if (check.rows.length === 0) {
      return fail(res, 404, 'Покупка не найдена или уже недоступна для редактирования');
    }

    await pool.query(
      `
      UPDATE purchases
      SET
        deliveryaddress = $1,
        contactphone = $2,
        contactemail = $3,
        comment = $4,
        paymentmethod = $5,
        updatedat = NOW()
      WHERE id = $6
      `,
      [
        deliveryaddress || null,
        contactphone || null,
        contactemail || null,
        comment || null,
        paymentmethod || null,
        id
      ]
    );

    return ok(res, {}, 'Покупка обновлена');
  } catch (error) {
    console.error('buyer purchase update error', error);
    return fail(res, 500, 'Ошибка сервера');
  }
});

router.delete('/purchases/:id', authenticateToken, requireRole(3), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const checkQuery = `
      SELECT pu.id
      FROM purchases pu
      JOIN customers c ON pu.idcustomer = c.id
      WHERE pu.id = $1 AND c.iduser = $2 AND pu.status = 'pending'
    `;

    const check = await pool.query(checkQuery, [id, userId]);

    if (check.rows.length === 0) {
      return fail(res, 404, 'Покупка не найдена или уже не может быть отменена');
    }

    await pool.query(`DELETE FROM purchases WHERE id = $1`, [id]);

    return ok(res, {}, 'Покупка отменена');
  } catch (error) {
    console.error('buyer purchase delete error', error);
    return fail(res, 500, 'Ошибка сервера');
  }
});

export default router;