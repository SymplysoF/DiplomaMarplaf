import { Router } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, requireRole } from '../../middleware/auth';

const router = Router();

router.get('/subscriptions', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const result = await pool.query(
      `
     SELECT
    fs.id,
    fs."createdAt",
    s.id AS "supplierId",
    s."userId" AS "supplierUserId",
    s.name AS "supplierName",
    sc.rating,
    sc.description,
    EXISTS (
        SELECT 1
        FROM "farmerCertificates" fc
        WHERE fc."supplierId" = s.id
          AND fc."certificateTypeId" = 1
          AND fc.status = 'active'
          AND (fc."expiryDate" IS NULL OR fc."expiryDate" > CURRENT_DATE)
    ) AS "hasEcoCertificate",
    (
        SELECT COUNT(*)
        FROM "supplierPlaces" sp
        WHERE sp."idSupplier" = s.id
    ) AS "placesCount"
FROM "farmerSubscriptions" fs
JOIN suppliers s ON fs."idSupplier" = s.id
LEFT JOIN "supplierCopies" sc ON sc."idSupplier" = s.id AND sc."isActual" = true
WHERE fs."idCustomer" = $1
ORDER BY fs."createdAt" DESC
      `,
      [userId]
    );

    res.json({ success: true, subscriptions: result.rows });
  } catch (error) {
    console.error('buyer subscriptions error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

router.post('/subscriptions', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { supplierId } = req.body;

    if (!supplierId) {
      return res.status(400).json({ success: false, message: 'Не указан фермер' });
    }

    const exists = await pool.query(
      `SELECT id FROM "farmerSubscriptions: WHERE "idCustomer" = $1 AND "idSupplier" = $2`,
      [userId, supplierId]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Подписка уже существует' });
    }

    await pool.query(
      `INSERT INTO "farmersubscriptions" ("idCustomer", "idSupplier") VALUES ($1, $2)`,
      [userId, supplierId]
    );

    res.json({ success: true, message: 'Подписка оформлена' });
  } catch (error) {
    console.error('buyer subscription create error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

router.delete('/subscriptions/:supplierId', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { supplierId } = req.params;

    await pool.query(
      `DELETE FROM "farmerSubscriptions" WHERE "idCustomer" = $1 AND "idSupplier" = $2`,
      [userId, supplierId]
    );

    res.json({ success: true, message: 'Подписка отменена' });
  } catch (error) {
    console.error('buyer subscription delete error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

export default router;