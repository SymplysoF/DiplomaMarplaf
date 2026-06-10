import { Router, Request, Response } from 'express';
import { pool } from '../config/db';
import { authenticateToken, requireRole } from '../middleware/auth';
import { buildImageUrls, normalizeImagePath, sendImageThumbnail } from '../utils/imageUtils';
import { addSupplierWarehouseClient } from '../utils/warehouseEvent';

const router = Router();
const MARKET_LOCATION_ID = 1;
const AUCTION_LOCATION_ID = 2;
const WAREHOUSE_LOCATION_ID = 3;

function mapProductRow(req: Request, row: any) {
  const urls = buildImageUrls(req, row.image_path);
  return {
    productCopyId: Number(row.product_copy_id || 0), productId: Number(row.product_id || 0), name: row.product_name || '', description: row.description || '',
    objectName: row.object_name || '', varietyName: row.variety_name || '', categoryName: row.category_name || '', freshnessName: row.freshness_name || '',
    supplierId: row.supplier_id ? Number(row.supplier_id) : null, supplierName: row.supplier_name || '', supplierRating: row.supplier_rating == null ? null : Number(row.supplier_rating),
    placeId: row.place_id ? Number(row.place_id) : null, placeAddress: row.place_address || '', kadastrNumber: row.place_kadastr || '', unitName: row.unit_name || '',
    locationId: row.location_id ? Number(row.location_id) : null, locationName: row.location_name || '', wholepart: Number(row.wholepart || 0), copecks: Number(row.copecks || 0),
    discount: row.discount == null ? null : Number(row.discount), price: Number(row.wholepart || 0) + Number(row.copecks || 0) / 100,
    weight: row.weight == null ? null : Number(row.weight), calories: row.calories == null ? null : Number(row.calories), proteines: row.proteines == null ? null : Number(row.proteines),
    lipides: row.lipides == null ? null : Number(row.lipides), glucides: row.glucides == null ? null : Number(row.glucides), joules: row.joules == null ? null : Number(row.joules),
    packaging: row.packaging || '', imagePath: normalizeImagePath(row.image_path), imageUrl: urls.imageUrl, thumbnailUrl: urls.thumbnailUrl
  };
}

const productSelectSql = `
  SELECT DISTINCT ON (pc.id)
    pc.id AS product_copy_id, pc."idProduct" AS product_id, pc.discount, pc.copecks, pc."wholePart" AS wholepart, pc.decsription AS description,
    pc.rating, pc."idDimension", pc.weight, pc.proteines, pc.lipides, pc.glucides, pc.calories, pc.joules, pc.packaging, pc."idLocationProduct" AS location_id,
    pr.name AS product_name, pr."imagePath" AS image_path,
    no.name AS object_name, v.name AS variety_name, cat.name AS category_name, f.name AS freshness_name,
    s.id AS supplier_id, s.name AS supplier_name, sc.rating AS supplier_rating,
    pl.id AS place_id, pl.address AS place_address, pl."kadastrNumber" AS place_kadastr,
    d.name AS unit_name, lp.name AS location_name
  FROM public."productCopies" pc
  JOIN public.products pr ON pc."idProduct" = pr.id
  LEFT JOIN public."namesObjects" no ON pr."idObject" = no.id
  LEFT JOIN public.varieties v ON no."idVariety" = v.id
  LEFT JOIN public."productCategories" pcats ON pr.id = pcats."idProduct"
  LEFT JOIN public."productCategory" cat ON pcats."idCategory" = cat.id
  LEFT JOIN public.freshness f ON pc."idFreshness" = f.id
  LEFT JOIN public."productDimensions" d ON pc."idDimension" = d.id
  LEFT JOIN public."locationProduct" lp ON pc."idLocationProduct" = lp.id
  LEFT JOIN public."supplierPlacesProducts" spp ON pr.id = spp."idProduct"
  LEFT JOIN public."supplierPlaces" sp ON spp."idSupplierPlace" = sp.id
  LEFT JOIN public.suppliers s ON sp."idSupplier" = s.id
  LEFT JOIN public."supplierCopies" sc ON sc."idSupplier" = s.id AND sc."isActual" = true
  LEFT JOIN public.places pl ON sp."idPlace" = pl.id
`;

router.get('/mobile/image-thumb', async (req, res) => sendImageThumbnail(req, res));

router.get('/buyer/mobile/market', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const result = await pool.query(`${productSelectSql} WHERE pc."isActual" = true AND pc."idLocationProduct" = $1 ORDER BY pc.id DESC`, [MARKET_LOCATION_ID]);
    return res.json({ success: true, products: result.rows.map((row) => mapProductRow(req, row)) });
  } catch (error) { console.error('buyer mobile market error:', error); return res.status(500).json({ success: false, message: 'Ошибка получения рынка' }); }
});

router.post('/buyer/mobile/purchases', authenticateToken, requireRole(3), async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = (req as any).user.userId;
    const { productCopyId, quantity = 1, paymentMethod = 'card', deliveryAddress = '', contactPhone = '', contactEmail = '', comment = '' } = req.body;
    if (!productCopyId) return res.status(400).json({ success: false, message: 'productCopyId обязателен' });
    const productResult = await client.query(`
      SELECT pc.id AS product_copy_id, pc."idProduct" AS product_id, COALESCE(sp."idSupplier", 1) AS supplier_id, sp."idPlace" AS place_id
      FROM public."productCopies" pc
      JOIN public.products pr ON pc."idProduct" = pr.id
      LEFT JOIN public."supplierPlacesProducts" spp ON pr.id = spp."idProduct"
      LEFT JOIN public."supplierPlaces" sp ON spp."idSupplierPlace" = sp.id
      WHERE pc.id = $1 AND pc."isActual" = true LIMIT 1`, [productCopyId]);
    if (productResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Товар не найден' });
    const product = productResult.rows[0];
    await client.query('BEGIN');
    const insertResult = await client.query(`
      INSERT INTO public.purchases ("idProduct", "idSupplier", "idCustomer", "idPlace", quantity, status, "paymentMethod", "deliveryAddress", "contactPhone", "contactEmail", comment, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING id`,
      [product.product_id, product.supplier_id, userId, product.place_id, Math.max(Number(quantity || 1), 1), paymentMethod, deliveryAddress, contactPhone, contactEmail, comment]);
    await client.query('COMMIT');
    return res.status(201).json({ success: true, message: 'Покупка создана', purchaseId: insertResult.rows[0].id });
  } catch (error: any) { await client.query('ROLLBACK'); console.error('buyer create purchase error:', error); return res.status(500).json({ success: false, message: error.message || 'Ошибка создания покупки' }); }
  finally { client.release(); }
});

router.get('/buyer/mobile/purchases', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    console.log('BUYER PURCHASES USER ID:', userId);
    const result = await pool.query(`
      SELECT DISTINCT ON (pu.id)
        pu.id AS purchase_id, pu.quantity, pu.status, pu."paymentMethod" AS payment_method, pu."deliveryAddress" AS delivery_address, pu."contactPhone" AS contact_phone, pu."contactEmail" AS contact_email,
        pu.comment, pu."createdAt" AS created_at, pu."completedAt" AS completed_at,
        pc.id AS product_copy_id, pc."idProduct" AS product_id, pc.discount, pc.copecks, pc."wholePart" AS wholepart, pc.decsription AS description, pc.rating, pc."idDimension", pc.weight,
        pc.proteines, pc.lipides, pc.glucides, pc.calories, pc.joules, pc.packaging, pc."idLocationProduct" AS location_id,
        pr.name AS product_name, pr."imagePath" AS image_path, no.name AS object_name, v.name AS variety_name, cat.name AS category_name, f.name AS freshness_name,
        s.id AS supplier_id, s.name AS supplier_name, sc.rating AS supplier_rating, pl.id AS place_id, pl.address AS place_address, pl."kadastrNumber" AS place_kadastr, d.name AS unit_name, lp.name AS location_name
      FROM public.purchases pu
      JOIN public.products pr ON pu."idProduct" = pr.id
      LEFT JOIN public."productCopies" pc ON pc."idProduct" = pr.id AND pc."isActual" = true
      LEFT JOIN public."namesObjects" no ON pr."idObject" = no.id
      LEFT JOIN public.varieties v ON no."idVariety" = v.id
      LEFT JOIN public."productCategories" pcats ON pr.id = pcats."idProduct"
      LEFT JOIN public."productCategory" cat ON pcats."idCategory" = cat.id
      LEFT JOIN public.freshness f ON pc."idFreshness" = f.id
      LEFT JOIN public."productDimensions" d ON pc."idDimension" = d.id
      LEFT JOIN public."locationProduct" lp ON pc."idLocationProduct" = lp.id
      LEFT JOIN public.suppliers s ON pu."idSupplier" = s.id
      LEFT JOIN public."supplierCopies" sc ON sc."idSupplier" = s.id AND sc."isActual" = true
      LEFT JOIN public.places pl ON pu."idPlace" = pl.id
      WHERE pu."idCustomer" = $1
      ORDER BY pu.id DESC, pc.id DESC`, [userId]);
    const purchases = result.rows.map((row) => ({ id: Number(row.purchase_id), quantity: Number(row.quantity || 1), status: row.status || '', paymentMethod: row.payment_method || '', deliveryAddress: row.delivery_address || '', contactPhone: row.contact_phone || '', contactEmail: row.contact_email || '', comment: row.comment || '', createdAt: row.created_at, completedAt: row.completed_at, totalPrice: (Number(row.wholepart || 0) + Number(row.copecks || 0) / 100) * Number(row.quantity || 1), product: mapProductRow(req, row) }));
    return res.json({ success: true, purchases });
  } catch (error) { console.error('buyer purchases error:', error); return res.status(500).json({ success: false, message: 'Ошибка получения покупок' }); }
});

router.put('/buyer/mobile/purchases/:purchaseId/verification', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId; const purchaseId = Number(req.params.purchaseId); const { verificationComment } = req.body;
    const result = await pool.query(`UPDATE public.purchases SET comment = $1, "updatedAt" = NOW() WHERE id = $2 AND "idCustomer" = $3 RETURNING id`, [verificationComment || '', purchaseId, userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Покупка не найдена' });
    return res.json({ success: true, message: 'Результат проверки сохранён' });
  } catch (error) { console.error('save verification error:', error); return res.status(500).json({ success: false, message: 'Ошибка сохранения проверки' }); }
});

router.get('/supplier/mobile/warehouse', authenticateToken, requireRole(2), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const supplierResult = await pool.query(`SELECT id FROM public.suppliers WHERE "userId" = $1`, [userId]);
    if (supplierResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Поставщик не найден' });
    const result = await pool.query(`${productSelectSql} WHERE pc."isActual" = true AND s.id = $1 ORDER BY pc.id DESC`, [supplierResult.rows[0].id]);
    return res.json({ success: true, products: result.rows.map((row) => mapProductRow(req, row)) });
  } catch (error) { console.error('supplier mobile warehouse error:', error); return res.status(500).json({ success: false, message: 'Ошибка получения склада' }); }
});

router.put('/supplier/mobile/warehouse/:productCopyId/move', authenticateToken, requireRole(2), async (req, res) => {
  try {
    const userId = (req as any).user.userId; const productCopyId = Number(req.params.productCopyId); const newLocation = Number(req.body.newLocation);
    if (![MARKET_LOCATION_ID, AUCTION_LOCATION_ID, WAREHOUSE_LOCATION_ID].includes(newLocation)) return res.status(400).json({ success: false, message: 'Некорректная локация' });
    const checkResult = await pool.query(`SELECT pc.id FROM public."productCopies" pc JOIN public.products pr ON pc."idProduct" = pr.id JOIN public."supplierPlacesProducts" spp ON pr.id = spp."idProduct" JOIN public."supplierPlaces" sp ON spp."idSupplierPlace" = sp.id JOIN public.suppliers s ON sp."idSupplier" = s.id WHERE pc.id = $1 AND s."userId" = $2 LIMIT 1`, [productCopyId, userId]);
    if (checkResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Товар не найден или не принадлежит поставщику' });
    await pool.query(`UPDATE public."productCopies" SET "idLocationProduct" = $1 WHERE id = $2`, [newLocation, productCopyId]);
    const locationNames: Record<number, string> = { [MARKET_LOCATION_ID]: 'рынок', [AUCTION_LOCATION_ID]: 'аукцион', [WAREHOUSE_LOCATION_ID]: 'склад' };
    return res.json({ success: true, message: `Товар перемещён: ${locationNames[newLocation]}`, newLocation });
  } catch (error) { console.error('supplier move warehouse product error:', error); return res.status(500).json({ success: false, message: 'Ошибка перемещения товара' }); }
});

router.get('/supplier/warehouse/events', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const supplierResult = await pool.query(
      `SELECT id FROM public.suppliers WHERE "userId" = $1`,
      [userId]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Поставщик не найден'
      });
    }

    const supplierId = Number(supplierResult.rows[0].id);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', supplierId })}\n\n`);

    addSupplierWarehouseClient(supplierId, res);
  } catch (error: any) {
    console.error('supplier warehouse events error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка подключения событий склада'
    });
  }
});

export default router;
