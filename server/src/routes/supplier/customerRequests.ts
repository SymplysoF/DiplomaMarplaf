import { Router } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, requireRole } from '../../middleware/auth';

const router = Router();

async function getSupplierIdByUserId(userId: number) {
  const supplierResult = await pool.query(
    `
    SELECT id
    FROM suppliers
    WHERE "userId" = $1
    LIMIT 1
    `,
    [userId]
  );

  if (supplierResult.rows.length === 0) {
    return null;
  }

  return supplierResult.rows[0].id;
}

/**
 * GET /api/supplier/customer-requests
 * All customer requests visible for supplier
 */
router.get('/customer-requests', authenticateToken, requireRole(2), async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        br.id,
        br."userId" AS buyer_id,
        u."userName" AS buyer_name,
        br."productName" AS product_name,
        br."objectId" AS object_id,
        no.name AS object_name,
        br."quantityNeeded" AS quantity_needed,
        br."dimensionId" AS dimension_id,
        d.name AS dimension_name,
        br."maxPriceWhole" AS max_price_whole,
        br."maxPriceCopecks" AS max_price_copecks,
        br."deliveryDate" AS delivery_date,
        br.comment,
        br."expiresAt" AS expires_at,
        br.status,
        br."createdAt" AS created_at
      FROM "buyerRequests" br
      LEFT JOIN "namesObjects" no ON br."objectId" = no.id
      LEFT JOIN "productDimensions" d ON br."dimensionId" = d.id
      LEFT JOIN users u ON br."userId" = u.id
      ORDER BY
        CASE
          WHEN br.status = 'active' THEN 0
          WHEN br.status = 'fulfilled' THEN 1
          WHEN br.status = 'expired' THEN 2
          ELSE 3
        END,
        br."createdAt" DESC
      `
    );

    res.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error('supplier customer requests get error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/**
 * GET /api/supplier/customer-requests/my-responses
 * All responses from current supplier
 */
router.get('/customer-requests/my-responses', authenticateToken, requireRole(2), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const supplierId = await getSupplierIdByUserId(userId);

    if (!supplierId) {
      return res.status(404).json({
        success: false,
        message: 'Поставщик не найден'
      });
    }

    const result = await pool.query(
      `
      SELECT
        rr.id,
        rr."requestId" AS request_id,
        rr."supplierId" AS supplier_id,
        s."name" AS supplier_name,
        rr."offeredPriceWhole" AS offered_price_whole,
        rr."offeredPriceCopecks" AS offered_price_copecks,
        rr."estimatedQuantity" AS estimated_quantity,
        rr."deliveryDays" AS delivery_days,
        rr."responseText" AS response_text,
        rr.status,
        rr."createdAt" AS created_at,

        br."productName" AS product_name,
        br."userId" AS buyer_id,
        u."userName" AS buyer_name,
        br."quantityNeeded" AS quantity_needed,
        br."maxPriceWhole" AS max_price_whole,
        br."maxPriceCopecks" AS max_price_copecks,
        br."expiresAt" AS expires_at
      FROM "requestResponses" rr
      JOIN suppliers s ON rr."supplierId" = s.id
      JOIN "buyerRequests" br ON rr."requestId" = br.id
      LEFT JOIN users u ON br."userId" = u.id
      WHERE rr."supplierId" = $1
      ORDER BY rr."createdAt" DESC
      `,
      [supplierId]
    );

    res.json({ success: true, responses: result.rows });
  } catch (error) {
    console.error('supplier my responses get error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/**
 * GET /api/supplier/customer-requests/:requestId/responses
 * All responses for one buyer request
 */
router.get('/customer-requests/:requestId/responses', authenticateToken, requireRole(2), async (req, res) => {
  try {
    const { requestId } = req.params;

    const result = await pool.query(
      `
      SELECT
        rr.id,
        rr."requestId" AS request_id,
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
      WHERE rr."requestId" = $1
      ORDER BY rr."createdAt" DESC
      `,
      [requestId]
    );

    res.json({ success: true, responses: result.rows });
  } catch (error) {
    console.error('supplier request responses get error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/**
 * POST /api/supplier/customer-requests/:requestId/respond
 * Create response from current supplier to customer request
 */
router.post('/customer-requests/:requestId/respond', authenticateToken, requireRole(2), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { requestId } = req.params;
    const {
      offered_price_whole,
      offered_price_copecks,
      estimated_quantity,
      delivery_days,
      response_text
    } = req.body;

    const supplierId = await getSupplierIdByUserId(userId);

    if (!supplierId) {
      return res.status(404).json({
        success: false,
        message: 'Поставщик не найден'
      });
    }

    const requestCheck = await pool.query(
      `
      SELECT id, status, "expiresAt"
      FROM "buyerRequests"
      WHERE id = $1
      LIMIT 1
      `,
      [requestId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Запрос не найден'
      });
    }

    const requestRow = requestCheck.rows[0];

    if (requestRow.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Можно откликаться только на активные запросы'
      });
    }

    if (requestRow.expiresAt && new Date(requestRow.expiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Срок действия запроса истёк'
      });
    }

    const existingResponse = await pool.query(
      `
      SELECT id
      FROM "requestResponses"
      WHERE "requestId" = $1 AND "supplierId" = $2
      LIMIT 1
      `,
      [requestId, supplierId]
    );

    if (existingResponse.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Вы уже откликнулись на этот запрос'
      });
    }

    const insertResult = await pool.query(
      `
      INSERT INTO "requestResponses" (
        "requestId",
        "supplierId",
        "offeredPriceWhole",
        "offeredPriceCopecks",
        "estimatedQuantity",
        "deliveryDays",
        "responseText",
        status,
        "createdAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
      RETURNING id
      `,
      [
        requestId,
        supplierId,
        offered_price_whole,
        offered_price_copecks || 0,
        estimated_quantity,
        delivery_days,
        response_text || null
      ]
    );

    res.json({
      success: true,
      id: insertResult.rows[0].id
    });
  } catch (error) {
    console.error('supplier request respond error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/**
 * PUT /api/supplier/customer-requests/responses/:responseId
 * Update current supplier response
 */
router.put('/customer-requests/responses/:responseId', authenticateToken, requireRole(2), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { responseId } = req.params;
    const {
      offered_price_whole,
      offered_price_copecks,
      estimated_quantity,
      delivery_days,
      response_text
    } = req.body;

    const supplierId = await getSupplierIdByUserId(userId);

    if (!supplierId) {
      return res.status(404).json({
        success: false,
        message: 'Поставщик не найден'
      });
    }

    const responseCheck = await pool.query(
      `
      SELECT id
      FROM "requestResponses"
      WHERE id = $1 AND "supplierId" = $2
      LIMIT 1
      `,
      [responseId, supplierId]
    );

    if (responseCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Отклик не найден'
      });
    }

    await pool.query(
      `
      UPDATE "requestResponses"
      SET
        "offeredPriceWhole" = $1,
        "offeredPriceCopecks" = $2,
        "estimatedQuantity" = $3,
        "deliveryDays" = $4,
        "responseText" = $5
      WHERE id = $6 AND "supplierId" = $7
      `,
      [
        offered_price_whole,
        offered_price_copecks || 0,
        estimated_quantity,
        delivery_days,
        response_text || null,
        responseId,
        supplierId
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('supplier response update error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

export default router;