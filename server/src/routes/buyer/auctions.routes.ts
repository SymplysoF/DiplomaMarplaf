import { Router } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, requireRole } from '../../middleware/auth';

const router = Router();

/**
 * Helpers
 */
function splitAmount(amount: number) {
  const normalized = Number(amount || 0);
  const whole = Math.floor(normalized);
  const copecks = Math.round((normalized - whole) * 100);
  return { whole, copecks };
}

async function getAuctionById(auctionId: number) {
  const result = await pool.query(
    `
    SELECT
      a.id,
      a."lotNumber"          AS "lotNumber",
      a.title,
      a.description,
      a."idProduct"          AS idproduct,
      p.name                 AS "productName",
      COALESCE(cat.name, 'Без категории') AS "categoryName",
      a."startPrice"         AS startprice,
      a."minStep"            AS minstep,
      a."buyNowPrice"        AS buynowprice,
      a."startTime"          AS starttime,
      a."endTime"            AS endtime,
      CASE
        WHEN ah.status = 'cancelled' THEN 'cancelled'
        WHEN a."endTime" < NOW() THEN 'ended'
        ELSE 'active'
      END                    AS status,
      a.vatincluded      AS vatincluded,
      a."deliveryRegion"     AS deliveryregion,
      pl.address             AS "placeAddress",
      (
        SELECT MAX(ab."bidAmountWhole" + ab."bidAmountCopecks" / 100.0)
        FROM public."auctionBids" ab
        WHERE ab."idAuction" = a.id
      )                      AS "currentBid",
      (
        SELECT COUNT(*)
        FROM public."auctionBids" ab
        WHERE ab."idAuction" = a.id
      )                      AS "bidsCount"
    FROM public.auctions a
    LEFT JOIN public.products p
      ON p.id = a."idProduct"
    LEFT JOIN public."productCategories" pcs
      ON pcs."idProduct" = p.id
    LEFT JOIN public."productCategory" cat
      ON cat.id = pcs."idCategory"
    LEFT JOIN public."supplierPlaces" sp
      ON sp.id = a."idPlace"
    LEFT JOIN places pl ON pl.id = a."idPlace"
    LEFT JOIN LATERAL (
      SELECT h.status
      FROM public."auctionHistory" h
      WHERE h."idAuction" = a.id
        AND h."isActive" = true
      ORDER BY h."changedAt" DESC, h.id DESC
      LIMIT 1
    ) ah ON true
    WHERE a.id = $1
    `,
    [auctionId]
  );

  return result.rows[0] || null;
}

/**
 * READ all auctions for buyer
 */
router.get('/auctions', authenticateToken, requireRole(3), async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        a.id,
        a."lotNumber"          AS "lotNumber",
        a.title,
        a.description,
        a."idProduct"          AS idproduct,
        p.name                 AS "productName",
        COALESCE(cat.name, 'Без категории') AS "categoryName",
        a."startPrice"         AS startprice,
        a."minStep"            AS minstep,
        a."buyNowPrice"        AS buynowprice,
        a."startTime"          AS starttime,
        a."endTime"            AS endtime,
        CASE
          WHEN ah.status = 'cancelled' THEN 'cancelled'
          WHEN a."endTime" < NOW() THEN 'ended'
          ELSE 'active'
        END                    AS status,
        a.vatincluded        AS vatincluded,
         pl.address             AS "placeAddress",
        a."deliveryRegion"     AS deliveryregion,
        (
          SELECT MAX(ab."bidAmountWhole" + ab."bidAmountCopecks" / 100.0)
          FROM public."auctionBids" ab
          WHERE ab."idAuction" = a.id
        )                      AS "currentBid",
        (
          SELECT COUNT(*)
          FROM public."auctionBids" ab
          WHERE ab."idAuction" = a.id
        )                      AS "bidsCount"
      FROM public.auctions a
      LEFT JOIN public.products p
        ON p.id = a."idProduct"
      LEFT JOIN public."productCategories" pcs
        ON pcs."idProduct" = p.id
      LEFT JOIN public."productCategory" cat
        ON cat.id = pcs."idCategory"
      LEFT JOIN public."supplierPlaces" sp
        ON sp.id = a."idPlace"
      LEFT JOIN places pl ON pl.id = a."idPlace"
      LEFT JOIN LATERAL (
        SELECT h.status
        FROM public."auctionHistory" h
        WHERE h."idAuction" = a.id
          AND h."isActive" = true
        ORDER BY h."changedAt" DESC, h.id DESC
        LIMIT 1
      ) ah ON true
      ORDER BY a.id DESC
      `
    );

    res.json({ success: true, auctions: result.rows });
  } catch (error) {
    console.error('buyer auctions error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/**
 * READ one auction
 */
router.get('/auctions/:id', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const auctionId = Number(req.params.id);
    if (!auctionId) {
      return res.status(400).json({ success: false, message: 'Некорректный ID аукциона' });
    }

    const auction = await getAuctionById(auctionId);

    if (!auction) {
      return res.status(404).json({ success: false, message: 'Аукцион не найден' });
    }

    res.json({ success: true, auction });
  } catch (error) {
    console.error('buyer auction details error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/**
 * READ auction bids
 */
router.get('/auctions/:id/bids', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const auctionId = Number(req.params.id);
    if (!auctionId) {
      return res.status(400).json({ success: false, message: 'Некорректный ID аукциона' });
    }

    const result = await pool.query(
      `
      SELECT
        ab.id,
        ab."bidAmountWhole"    AS bidamountwhole,
        ab."bidAmountCopecks"  AS bidamountcopecks,
        ab."bidTime"           AS bidtime,
        u."userName"           AS username,
        ab."isWinning"         AS iswinning
      FROM public."auctionBids" ab
      JOIN public.users u
        ON u.id = ab."idUser"
      WHERE ab."idAuction" = $1
      ORDER BY ab."bidTime" DESC, ab.id DESC
      `,
      [auctionId]
    );

    res.json({ success: true, bids: result.rows });
  } catch (error) {
    console.error('buyer auction bids error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/**
 * CREATE bid
 */
router.post('/auctions/:id/bid', authenticateToken, requireRole(3), async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = (req as any).user.userId;
    const auctionId = Number(req.params.id);
    const amount = Number(req.body.amount);

    if (!auctionId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Некорректные данные ставки' });
    }

    await client.query('BEGIN');

    const auctionRes = await client.query(
      `
      SELECT
        a.id,
        a."startPrice" AS startprice,
        a."minStep" AS minstep,
        a."buyNowPrice" AS buynowprice,
        a."endTime" AS endtime,
        (
          SELECT h.status
          FROM public."auctionHistory" h
          WHERE h."idAuction" = a.id
            AND h."isActive" = true
          ORDER BY h."changedAt" DESC, h.id DESC
          LIMIT 1
        ) AS history_status
      FROM public.auctions a
      WHERE a.id = $1
      FOR UPDATE
      `,
      [auctionId]
    );

    if (auctionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Аукцион не найден' });
    }

    const auction = auctionRes.rows[0];

    if (auction.history_status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Аукцион отменён' });
    }

    if (new Date(auction.endtime).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Аукцион уже завершён' });
    }

    const currentBidRes = await client.query(
      `
      SELECT MAX("bidAmountWhole" + "bidAmountCopecks" / 100.0) AS currentbid
      FROM public."auctionBids"
      WHERE "idAuction" = $1
      `,
      [auctionId]
    );

    const currentBid = currentBidRes.rows[0]?.currentbid
      ? Number(currentBidRes.rows[0].currentbid)
      : null;

    const minAllowed = currentBid !== null
      ? currentBid + Number(auction.minstep)
      : Number(auction.startprice);

    if (amount < minAllowed) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Минимальная ставка: ${minAllowed}`
      });
    }

    const { whole, copecks } = splitAmount(amount);

    await client.query(
      `
      UPDATE public."auctionBids"
      SET "isWinning" = false
      WHERE "idAuction" = $1
      `,
      [auctionId]
    );

    const insertRes = await client.query(
      `
      INSERT INTO public."auctionBids" (
        "idAuction",
        "idUser",
        "bidAmountWhole",
        "bidAmountCopecks",
        "bidTime",
        "isWinning"
      )
      VALUES ($1, $2, $3, $4, NOW(), true)
      RETURNING id
      `,
      [auctionId, userId, whole, copecks]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      bidId: insertRes.rows[0].id
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('buyer auction place bid error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

/**
 * READ my bids
 */
router.get('/my-bids', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const result = await pool.query(
      `
      SELECT
        ab.id,
        ab."idAuction"         AS idauction,
        ab."bidAmountWhole"    AS bidamountwhole,
        ab."bidAmountCopecks"  AS bidamountcopecks,
        ab."bidTime"           AS bidtime,
        ab."isWinning"         AS iswinning,
        a.title,
        a."lotNumber"          AS lotnumber
      FROM public."auctionBids" ab
      JOIN public.auctions a
        ON a.id = ab."idAuction"
      WHERE ab."idUser" = $1
      ORDER BY ab."bidTime" DESC, ab.id DESC
      `,
      [userId]
    );

    res.json({ success: true, bids: result.rows });
  } catch (error) {
    console.error('buyer my bids error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/**
 * UPDATE my bid
 * only latest own winning bid, only while auction is active
 */
router.put('/my-bids/:bidId', authenticateToken, requireRole(3), async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = (req as any).user.userId;
    const bidId = Number(req.params.bidId);
    const amount = Number(req.body.amount);

    if (!bidId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Некорректные данные ставки' });
    }

    await client.query('BEGIN');

    const bidRes = await client.query(
      `
      SELECT
        ab.id,
        ab."idAuction" AS idauction,
        ab."idUser" AS iduser
      FROM public."auctionBids" ab
      WHERE ab.id = $1
      FOR UPDATE
      `,
      [bidId]
    );

    if (bidRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Ставка не найдена' });
    }

    const bid = bidRes.rows[0];

    if (Number(bid.iduser) !== Number(userId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Нет доступа к ставке' });
    }

    const auctionRes = await client.query(
      `
      SELECT
        a.id,
        a."startPrice" AS startprice,
        a."minStep" AS minstep,
        a."endTime" AS endtime,
        (
          SELECT h.status
          FROM public."auctionHistory" h
          WHERE h."idAuction" = a.id
            AND h."isActive" = true
          ORDER BY h."changedAt" DESC, h.id DESC
          LIMIT 1
        ) AS history_status
      FROM public.auctions a
      WHERE a.id = $1
      FOR UPDATE
      `,
      [bid.idauction]
    );

    const auction = auctionRes.rows[0];

    if (!auction) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Аукцион не найден' });
    }

    if (auction.history_status === 'cancelled' || new Date(auction.endtime).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Аукцион уже недоступен' });
    }

    const topBidRes = await client.query(
      `
      SELECT
        id,
        ("bidAmountWhole" + "bidAmountCopecks" / 100.0) AS amount
      FROM public."auctionBids"
      WHERE "idAuction" = $1
        AND id <> $2
      ORDER BY amount DESC, id DESC
      LIMIT 1
      `,
      [bid.idauction, bidId]
    );

    const currentBidWithoutThis = topBidRes.rows.length > 0
      ? Number(topBidRes.rows[0].amount)
      : null;

    const minAllowed = currentBidWithoutThis !== null
      ? currentBidWithoutThis + Number(auction.minstep)
      : Number(auction.startprice);

    if (amount < minAllowed) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Минимальная ставка: ${minAllowed}`
      });
    }

    const { whole, copecks } = splitAmount(amount);

    await client.query(
      `
      UPDATE public."auctionBids"
      SET "isWinning" = false
      WHERE "idAuction" = $1
      `,
      [bid.idauction]
    );

    await client.query(
      `
      UPDATE public."auctionBids"
      SET
        "bidAmountWhole" = $1,
        "bidAmountCopecks" = $2,
        "bidTime" = NOW(),
        "isWinning" = true
      WHERE id = $3
      `,
      [whole, copecks, bidId]
    );

    await client.query('COMMIT');

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('buyer update bid error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

/**
 * DELETE my bid
 * only own bid, only while auction active
 */
router.delete('/my-bids/:bidId', authenticateToken, requireRole(3), async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = (req as any).user.userId;
    const bidId = Number(req.params.bidId);

    if (!bidId) {
      return res.status(400).json({ success: false, message: 'Некорректный ID ставки' });
    }

    await client.query('BEGIN');

    const bidRes = await client.query(
      `
      SELECT
        ab.id,
        ab."idAuction" AS idauction,
        ab."idUser" AS iduser
      FROM public."auctionBids" ab
      WHERE ab.id = $1
      FOR UPDATE
      `,
      [bidId]
    );

    if (bidRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Ставка не найдена' });
    }

    const bid = bidRes.rows[0];

    if (Number(bid.iduser) !== Number(userId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Нет доступа к ставке' });
    }

    const auctionRes = await client.query(
      `
      SELECT
        a."endTime" AS endtime,
        (
          SELECT h.status
          FROM public."auctionHistory" h
          WHERE h."idAuction" = a.id
            AND h."isActive" = true
          ORDER BY h."changedAt" DESC, h.id DESC
          LIMIT 1
        ) AS history_status
      FROM public.auctions a
      WHERE a.id = $1
      `,
      [bid.idauction]
    );

    const auction = auctionRes.rows[0];

    if (!auction) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Аукцион не найден' });
    }

    if (auction.history_status === 'cancelled' || new Date(auction.endtime).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Аукцион уже недоступен' });
    }

    await client.query(
      `DELETE FROM public."auctionBids" WHERE id = $1`,
      [bidId]
    );

    const topBidRes = await client.query(
      `
      SELECT id
      FROM public."auctionBids"
      WHERE "idAuction" = $1
      ORDER BY ("bidAmountWhole" + "bidAmountCopecks" / 100.0) DESC, id DESC
      LIMIT 1
      `,
      [bid.idauction]
    );

    if (topBidRes.rows.length > 0) {
      await client.query(
        `
        UPDATE public."auctionBids"
        SET "isWinning" = true
        WHERE id = $1
        `,
        [topBidRes.rows[0].id]
      );
    }

    await client.query('COMMIT');

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('buyer delete bid error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

export default router;