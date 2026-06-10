import { Router } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, requireRole } from '../../middleware/auth';

const router = Router();

router.get('/market/products', authenticateToken, requireRole(3), async (_req, res) => {
  try {
    const result = await pool.query(`
    SELECT
    p.id,
    p.name AS "productName",
    no.name AS "objectName",
    COALESCE(v.name, '') AS "varietyName",
    COALESCE(cat.name, 'Без категории') AS "categoryName",
    COALESCE(pc."wholePart", 0) AS wholepart,
    COALESCE(pc.copecks, 0) AS copecks,
    COALESCE(pc.weight, 0) AS weight,
    COALESCE(pc.weight, 1) AS quantity,
    COALESCE(d.name, 'шт') AS unit,
    pl.address AS "placeAddress",
    s.name AS "supplierName",
    s.id AS "supplierId"
FROM "productCopies" pc
JOIN products p ON pc."idProduct" = p.id
LEFT JOIN "namesObjects" no ON p."idObject" = no.id
LEFT JOIN varieties v ON no."idVariety" = v.id
LEFT JOIN "productCategories" pcs ON pcs."idProduct" = p.id
LEFT JOIN "productCategory" cat ON cat.id = pcs."idCategory"
LEFT JOIN "supplierPlacesProducts" spp ON spp."idProduct" = p.id
LEFT JOIN "supplierPlaces" sp ON sp.id = spp."idSupplierPlace"
LEFT JOIN places pl ON pl.id = sp."idPlace"
LEFT JOIN suppliers s ON s.id = sp."idSupplier"
LEFT JOIN "productDimensions" d ON d.id = pc."idDimension"
WHERE pc."isActual" = true AND pc."idLocationProduct" = 1
ORDER BY p.name ASC
    `);

    res.json({ success: true, products: result.rows });
  } catch (error) {
    console.error('buyer market products error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

router.get('/market/purchases', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const result = await pool.query(
      `
     SELECT
    pu.id,
    pr.name AS "productName",
    pu.quantity,
    COALESCE((pc."wholePart" + pc.copecks / 100.0) * pu.quantity, 0) AS totalprice,
    pu.status,
    pu."createdAt"
FROM "Purchases" pu
LEFT JOIN "Products" pr ON pu."idProduct" = pr.id
LEFT JOIN "productCopies" pc ON pc."idProduct" = pu."idProduct" AND pc."isActual" = true
WHERE pu."idCustomer" = $1
ORDER BY pu."createdAt" DESC
      `,
      [userId]
    );

    res.json({ success: true, purchases: result.rows });
  } catch (error) {
    console.error('buyer market purchases error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

router.post('/market/purchase', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { productId, quantity } = req.body;

    const productRes = await pool.query(
      `
      SELECT
        p.id,
        s.id as "supplierId",
        pl.id as "placeId"
      FROM products p
      LEFT JOIN supplierplacesproducts spp ON spp.idproduct = p.id
      LEFT JOIN supplierplaces sp ON sp.id = spp.idsupplierplace
      LEFT JOIN suppliers s ON s.id = sp.idsupplier
      LEFT JOIN places pl ON pl.id = sp.idplace
      WHERE p.id = $1
      LIMIT 1
      `,
      [productId]
    );

    if (productRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Товар не найден' });
    }

    const product = productRes.rows[0];

    await pool.query(
      `
      INSERT INTO purchases (
        idproduct, idsupplier, idcustomer, idplace, quantity, status, createdat
      )
      VALUES ($1,$2,$3,$4,$5,'pending',NOW())
      `,
      [productId, product.supplierId, userId, product.placeId, quantity]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('buyer market purchase error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

export default router;