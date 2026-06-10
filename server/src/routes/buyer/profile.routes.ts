import { Router } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, requireRole } from '../../middleware/auth';

const router = Router();

router.get('/profile', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const result = await pool.query(
      `
        SELECT 
        c.id,
        u."userName",
        u.email,
        c."deliveryAddress"
      FROM customers c
      JOIN users u ON c."idUser" = u.id
      WHERE c."idUser" = $1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Профиль не найден' });
    }

    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('buyer profile error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

router.put('/profile', authenticateToken, requireRole(3), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { deliveryaddress, contactphone } = req.body;

    await pool.query(`UPDATE customers SET "deliveryAddress" = $1 WHERE "idUser" = $2`, [deliveryaddress || '', userId]);
    await pool.query(`UPDATE users SET "contactPhone" = $1 WHERE id = $2`, [contactphone || '', userId]);

    res.json({ success: true, message: 'Профиль обновлён' });
  } catch (error) {
    console.error('buyer profile update error', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

export default router;