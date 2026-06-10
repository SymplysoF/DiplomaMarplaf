import { Router } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, requireRole } from '../../middleware/auth';

const router = Router();

router.get('/requests', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const result = await pool.query(
      `
   SELECT 
    br.id,
    br."productName" AS product_name,
    br."objectId" AS object_id,
    no.name AS object_name,
    br."quantityNeeded" AS quantity_needed,
    br."maxPriceWhole" AS max_price_whole,
    br."maxPriceCopecks" AS max_price_copecks,
    br."expiresAt" AS expires_at,
    br.status,
    br."createdAt" AS created_at
FROM "buyerRequests" br
LEFT JOIN "namesObjects" no ON br."objectId" = no.id
WHERE br."userId" = $1
ORDER BY br."createdAt" DESC
      `,
      [userId]
    );

    res.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error('buyer requests get error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});
router.post('/requests', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { product_name, object_id, quantity_needed, max_price_whole, max_price_copecks, expires_at, dimension_id } = req.body;

    const finalObjectId = (object_id && object_id > 0) ? object_id : null;

    const result = await pool.query(
      `
      INSERT INTO "buyerRequests" (
        "userId", "productName", "objectId", "quantityNeeded",
        "maxPriceWhole", "maxPriceCopecks", "expiresAt", status, "createdAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
      RETURNING id
      `,
      [userId, product_name, finalObjectId, quantity_needed, max_price_whole, max_price_copecks || 0, expires_at]
    );

    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('buyer request create error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});
router.delete('/requests/:id', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    await pool.query(`DELETE FROM "buyerRequests" WHERE id = $1 AND "userId" = $2`, [id, userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('buyer request delete error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

router.get('/requests/:id/responses', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const result = await pool.query(
      `
     SELECT
    rr.id,
    rr."supplierId" AS supplier_id,
    s.name AS supplier_name,
    rr."offeredPriceWhole" AS offered_price_whole,
    rr."offeredPriceCopecks" AS offered_price_copecks,
    rr."estimatedQuantity" AS estimated_quantity,
    rr."deliveryDays" AS delivery_days,
    rr."responseText" AS response_text,
    rr.status,
    rr."createdAt" AS created_at
FROM "requestResponses" rr
JOIN suppliers s ON rr."supplierId" = s.id
JOIN "buyerRequests" br ON rr."requestId" = br.id
WHERE rr."requestId" = $1 AND br."userId" = $2
ORDER BY rr."createdAt" DESC
      `,
      [id, userId]
    );

    res.json({ success: true, responses: result.rows });
  } catch (error) {
    console.error('buyer request responses error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

export default router;