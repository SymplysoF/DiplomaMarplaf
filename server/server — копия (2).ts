import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import sharp from 'sharp';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { setupSwagger } from './docs/swaggerSetup';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

import { pool } from './src/config/db';
import { authenticateToken, checkRole, requireRole } from './src/middleware/auth';
import buyerRoutes from './src/routes/buyer';
import customerRequestsRouter from './src/routes/supplier';
import logisticsRoutes from './src/routes/logistics.routes';

import { notifySupplierWarehouseUpdated } from './src/utils/warehouseEvent';
import createManagerModerationRouter from './src/routes/manager/moderation.routes';
import createAdminSystemRouter from './src/routes/admin/adminSystem.routes';
import createRegulatorRouter from './src/routes/regulator/regulator.routes';

import mobileMarketWarehouseRoutes from './src/routes/mobileMarketWarehouse.routes';
import { UPLOADS_ROOT } from './src/utils/imageUtils';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

setupSwagger(app);
// =============================================
// НАСТРОЙКА ЗАГРУЗКИ ФАЙЛОВ ДЛЯ СЕРТИФИКАТОВ
// =============================================

// Создаем директорию для загрузок, если её нет
const uploadDir = path.join(__dirname, '../uploads/certificates');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка хранилища для multer
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const userId = (req as any).user?.userId;
    const userDir = path.join(uploadDir, `user_${userId}`);

    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = path.parse(file.originalname).name.replace(/\s/g, '_');
    const extension = path.extname(file.originalname);
    cb(null, `${timestamp}_${originalName}${extension}`);
  }
});

// Фильтр файлов
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Неподдерживаемый формат файла. Разрешены: JPG, PNG, PDF'), false);
  }
};

const uploadCertificate = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter
});

// Раздаем статические файлы
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

interface User {
  id?: number;
  username: string;
  email: string;
  roleId: number;
  password: string;
}

const MARKET_LOCATION_ID = 1;
const AUCTION_LOCATION_ID = 2;
const WAREHOUSE_LOCATION_ID = 3;

// ========== MIDDLEWARE ==========
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(morgan('dev'));
app.use(cors({
  // origin: 'http://localhost:3000',
  origin: '*',
  credentials: true,  // Разрешить отправку credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/api/buyer', buyerRoutes);
app.use('/api/supplier', customerRequestsRouter);
app.use('/api/logistics', logisticsRoutes);
app.use('/uploads', express.static(UPLOADS_ROOT));
app.use('/api', mobileMarketWarehouseRoutes);

app.use('/api/manager', createManagerModerationRouter({ pool, authenticateToken }));
app.use(
  '/api/admin-system',
  createAdminSystemRouter({
    pool,
    authenticateToken,
    requireRole
  })
);
app.use('/api/regulator', createRegulatorRouter({ pool, authenticateToken }));

// ОТЛАДОЧНЫЙ endpoint - временно, без авторизации
app.get('/api/certificates/image/:certificateId', async (req: Request, res: Response) => {
  try {
    const { certificateId } = req.params;

    console.log('=== CERTIFICATE IMAGE REQUEST ===');
    console.log('Certificate ID:', certificateId);

    // Получаем информацию о сертификате
    const query = `
      SELECT id,   
    "documentPath" AS document_path,
    "documentName" AS document_name,
    "documentType" AS document_type,
     status
      FROM "farmerCertificates"
      WHERE id = $1
    `;

    const result = await pool.query(query, [certificateId]);

    if (result.rows.length === 0) {
      console.log('Certificate not found in DB for id:', certificateId);
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const cert = result.rows[0];
    console.log('Certificate found:', {
      id: cert.id,
      document_path: cert.document_path,
      document_name: cert.document_name,
      status: cert.status
    });

    if (!cert.document_path) {
      console.log('No document_path for certificate:', certificateId);
      return res.status(404).json({ error: 'No file path' });
    }

    // Формируем полный путь
    // __dirname = backend/src или backend/dist
    const filePath = path.join(__dirname, '..', cert.document_path);
    console.log('Full file path:', filePath);
    console.log('__dirname:', __dirname);

    // Проверяем существование файла
    const fileExists = fs.existsSync(filePath);
    console.log('File exists:', fileExists);

    if (!fileExists) {
      // Попробуем альтернативные пути
      const altPath1 = path.join(__dirname, '..', '..', cert.document_path);
      console.log('Alternative path 1:', altPath1, 'exists:', fs.existsSync(altPath1));

      const altPath2 = path.join(process.cwd(), cert.document_path);
      console.log('Alternative path 2:', altPath2, 'exists:', fs.existsSync(altPath2));

      const altPath3 = path.join(process.cwd(), 'uploads', 'certificates', `user_${cert.supplier_id}`, path.basename(cert.document_path));
      console.log('Alternative path 3:', altPath3, 'exists:', fs.existsSync(altPath3));

      return res.status(404).json({ error: 'File not found on server' });
    }

    // Определяем Content-Type
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.gif') contentType = 'image/gif';

    console.log('Sending file with contentType:', contentType);
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);

  } catch (error) {
    console.error('Error in certificate image endpoint:', error);
    res.status(500).json({ error: 'Server error', details: String(error) });
  }
});

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

async function createTestUser(userData: User) {
  try {
    // Хешируем пароль
    const hashedPassword = await hashPassword(userData.password);

    const query = `
      INSERT INTO users (userName, email, password, roleId) 
      VALUES ($1, $2, $3, $4) 
      RETURNING id, userName, email, roleId
    `;

    const values = [
      userData.username,
      userData.email,
      hashedPassword,
      userData.roleId
    ];

    const result = await pool.query(query, values);
    console.log('Пользователь создан:', result.rows[0]);
    return result.rows[0];
  } catch (error: any) {
    if (error.code === '23505') { // Ошибка уникальности
      console.error('Пользователь с таким username или email уже существует');
    } else {
      console.error('Ошибка создания пользователя:', error.message);
    }
    return null;
  }
}

async function verifyPassword(userId: number, plainPassword: string): Promise<boolean> {
  try {
    const query = 'SELECT password FROM users WHERE id = $1';
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return false;
    }

    const hashedPassword = result.rows[0].password;
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error('Ошибка проверки пароля:', error);
    return false;
  }
}
// =============================================
// МАРШРУТЫ ДЛЯ СЕРТИФИКАТОВ
// =============================================

// Получение всех типов сертификатов
app.get('/api/certificate/types', authenticateToken, async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT * FROM "certificateTypes" as "certificate_types"
      WHERE "isActive" = true 
      ORDER BY id
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      types: result.rows
    });
  } catch (error) {
    console.error('Error fetching certificate types:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения типов сертификатов'
    });
  }
});

// Получение сертификатов поставщика
app.get('/api/supplier/certificates', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const supplierQuery = 'SELECT id FROM suppliers WHERE "userId" = $1';
    const supplierResult = await pool.query(supplierQuery, [userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Профиль поставщика не найден'
      });
    }

    const supplierId = supplierResult.rows[0].id;

    const query = `
    SELECT 
  fc.id,
  fc."certificateTypeId" as certificate_type_id,
  ct.name as certificate_name,
  ct.description as certificate_description,
  ct.icon as certificate_icon,
  fc."certificateNumber" as certificate_number,
  fc."issuedBy" as issued_by,
  fc."issueDate" as issue_date,
  fc."expiryDate" as expiry_date,
  fc.status,
  fc."documentPath" as document_path,
  fc."documentName" as document_name,
  fc."documentType" as document_type,
  fc."verificationComment" as verification_comment,
  u."userName" as verifier_name,
  fc."verifiedAt" as verified_at
FROM "farmerCertificates" fc
JOIN "certificateTypes" ct ON fc."certificateTypeId" = ct.id
LEFT JOIN users u ON fc."verifiedBy" = u.id
WHERE fc."supplierId" = $1
    `;

    const result = await pool.query(query, [supplierId]);

    res.json({
      success: true,
      certificates: result.rows
    });
  } catch (error) {
    console.error('Error fetching supplier certificates:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения сертификатов'
    });
  }
});

// Подача заявки на сертификат
app.post(
  '/api/supplier/certificates/request',
  authenticateToken,
  requireRole(2),
  uploadCertificate.single('document'),
  async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
      const userId = (req as any).user.userId;
      const { certificate_type_id, certificate_number, issued_by } = req.body;

      if (!certificate_type_id) {
        return res.status(400).json({
          success: false,
          message: 'Тип сертификата обязателен'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Документ-подтверждение обязателен'
        });
      }

      const supplierQuery = 'SELECT id FROM suppliers WHERE "userId" = $1';
      const supplierResult = await pool.query(supplierQuery, [userId]);

      if (supplierResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Профиль поставщика не найден'
        });
      }

      const supplierId = supplierResult.rows[0].id;

      const checkQuery = `
        SELECT id FROM "certificateRequests" 
        WHERE "supplierId" = $1 AND "certificateTypeId" = $2 AND status = 'pending'
      `;
      const checkResult = await pool.query(checkQuery, [supplierId, certificate_type_id]);

      if (checkResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'У вас уже есть активная заявка на этот сертификат'
        });
      }

      const checkActiveQuery = `
        SELECT id FROM "farmerCertificates" 
        WHERE "supplierId" = $1 AND "certificateTypeId" = $2 AND status = 'active'
      `;
      const checkActiveResult = await pool.query(checkActiveQuery, [supplierId, certificate_type_id]);

      if (checkActiveResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'У вас уже есть активный сертификат этого типа'
        });
      }

      await client.query('BEGIN');

      const insertRequestQuery = `
        INSERT INTO "certificateRequests" ("supplierId", "certificateTypeId", status)
        VALUES ($1, $2, 'pending')
        RETURNING id
      `;
      const requestResult = await client.query(insertRequestQuery, [supplierId, certificate_type_id]);

      const documentPath = `/uploads/certificates/user_${userId}/${req.file.filename}`;
      const documentName = req.file.originalname;
      const documentType = req.file.mimetype;

      const insertCertQuery = `
        INSERT INTO "farmerCertificates" (
          "supplierId", "certificateTypeId", "certificateNumber", 
          "issuedBy", status, "documentPath", "documentName", "documentType"
        )
        VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
        RETURNING id
      `;

      const certResult = await client.query(insertCertQuery, [
        supplierId,
        certificate_type_id,
        certificate_number || null,
        issued_by || null,
        documentPath,
        documentName,
        documentType
      ]);

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Заявка на сертификат успешно подана',
        request_id: requestResult.rows[0].id,
        certificate_id: certResult.rows[0].id,
        file: {
          filename: req.file.filename,
          path: documentPath,
          size: req.file.size
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error requesting certificate:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка подачи заявки'
      });
    } finally {
      client.release();
    }
  }
);

// Скачивание файла сертификата
app.get('/api/certificates/download/:certificateId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { certificateId } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.roleId;

    const query = `
    SELECT
  fc."documentPath" as document_path,
  fc."documentName" as document_name,
  fc."supplierId" as supplier_id
FROM "farmerCertificates" fc
WHERE fc.id = $1
    `;

    const result = await pool.query(query, [certificateId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Сертификат не найден'
      });
    }

    const certificate = result.rows[0];

    const supplierQuery = 'SELECT userid FROM suppliers WHERE id = $1';
    const supplierResult = await pool.query(supplierQuery, [certificate.supplier_id]);
    const ownerId = supplierResult.rows[0]?.userid;

    const isOwner = ownerId === userId;
    const isAdmin = userRole === 1;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Нет доступа к файлу'
      });
    }

    if (!certificate.document_path) {
      return res.status(404).json({
        success: false,
        message: 'Файл не найден'
      });
    }

    const filePath = path.resolve(
      __dirname,
      '..',
      certificate.document_path.replace(/^\/+/, '')
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Файл не найден на сервере'
      });
    }

    res.download(filePath, certificate.document_name || 'document');

  } catch (error) {
    console.error('Error downloading certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка скачивания файла'
    });
  }
});

// Обновление настроек отображения сертификатов
app.put('/api/supplier/certificates/settings', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { show_certificates } = req.body;

    const query = `
      UPDATE suppliers 
      SET showCertificates = $1 
      WHERE userId = $2 
      RETURNING *
    `;

    const result = await pool.query(query, [show_certificates, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Профиль поставщика не найден'
      });
    }

    res.json({
      success: true,
      message: 'Настройки обновлены',
      show_certificates: result.rows[0].showCertificates
    });
  } catch (error) {
    console.error('Error updating certificate settings:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления настроек'
    });
  }
});

// =============================================
// АДМИН МАРШРУТЫ ДЛЯ СЕРТИФИКАТОВ
// =============================================
// Получение изображения сертификата (для отображения в браузере)
app.get('/api/certificates/image/:certificateId', authenticateToken, async (req: Request, res: Response) => {
  try {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    const { certificateId } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.roleId;

    const query = `
      SELECT fc."documentPath" as 'document_path', fc."documentName" as 'document_name', fc."supplierId" as 'supplier_id'
      FROM "farmerCertificates" fc
      WHERE fc.id = $1
    `;

    const result = await pool.query(query, [certificateId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Сертификат не найден'
      });
    }

    const certificate = result.rows[0];

    // Проверяем права доступа
    const supplierQuery = 'SELECT userId as "userid" FROM suppliers WHERE id = $1';
    const supplierResult = await pool.query(supplierQuery, [certificate.supplier_id]);
    const ownerId = supplierResult.rows[0]?.userid;

    const isOwner = ownerId === userId;
    const isAdmin = userRole === 1;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Нет доступа к файлу'
      });
    }

    if (!certificate.document_path) {
      return res.status(404).json({
        success: false,
        message: 'Файл не найден'
      });
    }

    const filePath = path.resolve(
      __dirname,
      '..',
      certificate.document_path.replace(/^\/+/, '')
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Файл не найден на сервере'
      });
    }

    // Определяем Content-Type
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.pdf') contentType = 'application/pdf';

    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);

  } catch (error) {
    console.error('Error serving certificate image:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения файла'
    });
  }
});
// Получение всех заявок на сертификаты
app.get('/api/admin/certificate-requests', authenticateToken, requireRole(1), async (req: Request, res: Response) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        cr.*,
        s.name as supplier_name,
        s.id as supplier_id,
        u.username,
        u.email,
        ct.name as certificate_name,
        ct.description as certificate_description
      FROM certificate_requests cr
      JOIN suppliers s ON cr.supplier_id = s.id
      JOIN users u ON s.userid = u.id
      JOIN certificate_types ct ON cr.certificate_type_id = ct.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND cr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += `
      ORDER BY cr.request_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQuery = `SELECT COUNT(*) as total FROM certificate_requests cr WHERE 1=1`;
    const countParams: any[] = [];
    if (status) {
      countQuery += ` AND cr.status = $1`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = countResult.rows[0]?.total || 0;

    res.json({
      success: true,
      requests: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching certificate requests:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения заявок'
    });
  }
});

// Одобрение/отклонение заявки
app.put('/api/admin/certificate-requests/:requestId', authenticateToken, requireRole(1), async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const { requestId } = req.params;
    const { status, admin_comment, issue_date, expiry_date } = req.body;
    const adminId = (req as any).user.userId;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный статус'
      });
    }

    await client.query('BEGIN');

    const requestQuery = `
      SELECT cr.*, fc.id as certificate_id
      FROM certificate_requests cr
      LEFT JOIN farmer_certificates fc ON cr.supplier_id = fc.supplier_id 
        AND cr.certificate_type_id = fc.certificate_type_id
      WHERE cr.id = $1
    `;
    const requestResult = await client.query(requestQuery, [requestId]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
    }

    const request = requestResult.rows[0];

    const updateRequestQuery = `
      UPDATE certificate_requests 
      SET status = $1, admin_comment = $2, processed_by = $3, processed_at = NOW()
      WHERE id = $4
    `;
    await client.query(updateRequestQuery, [status, admin_comment, adminId, requestId]);

    if (status === 'approved') {
      const updateCertQuery = `
        UPDATE farmer_certificates 
        SET 
          status = 'active',
          issue_date = COALESCE($1, CURRENT_DATE),
          expiry_date = COALESCE($2, CURRENT_DATE + INTERVAL '365 days'),
          verified_by = $3,
          verified_at = NOW()
        WHERE id = $4
      `;
      await client.query(updateCertQuery, [issue_date, expiry_date, adminId, request.certificate_id]);
    } else if (status === 'rejected') {
      const updateCertQuery = `
        UPDATE farmer_certificates 
        SET status = 'rejected', verification_comment = $1
        WHERE id = $2
      `;
      await client.query(updateCertQuery, [admin_comment, request.certificate_id]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: status === 'approved' ? 'Сертификат одобрен' : 'Заявка отклонена'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing certificate request:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обработки заявки'
    });
  } finally {
    client.release();
  }
});

// ========== PUBLIC ROUTES (без аутентификации) ==========

// Регистрация
app.post('/api/supplier/register', async (req: Request, res: Response) => {
  try {
    const { name, description, userName, email, password } = req.body;

    // Валидация
    if (!name || !userName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Все обязательные поля должны быть заполнены'
      });
    }

    // Проверка уникальности email и username
    const checkQuery = `
      SELECT id FROM users 
      WHERE email = $1 OR userName = $2
    `;

    const checkResult = await pool.query(checkQuery, [email, userName]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Пользователь с таким email или username уже существует'
      });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Вызов функции PL/pgSQL для создания поставщика
    const query = `
      SELECT createUserWithRoleSupplier($1, $2, $3, $4, $5) as userid
    `;

    const result = await pool.query(query, [
      name,
      description || '',
      userName,
      email,
      hashedPassword
    ]);

    const userId = result.rows[0].userid;

    // Генерируем JWT токен
    const token = jwt.sign(
      {
        userId: userId,
        roleId: 2, // Важно: roleId вместо role
        role: 'Поставщик',
        username: userName,
        name: name
      },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Поставщик успешно зарегистрирован',
      userId: userId,
      token: token,
      user: {
        userId: userId,
        roleId: 2,
        role: 'Поставщик',
        username: userName,
        name: name
      }
    });

  } catch (error: any) {
    console.error('Error creating supplier:', error);

    if (error.code === '23505') { // Ошибка уникальности
      res.status(400).json({
        success: false,
        message: 'Пользователь с такими данными уже существует'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при создании поставщика'
      });
    }
  }
});

// Создание пользователя (для админа, но пока оставим публичным для тестов)
app.post('/api/users/create', async (req: Request, res: Response) => {
  try {
    const { username, email, password, roleId } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Все поля обязательны'
      });
    }

    const user = await createTestUser({ username, email, password, roleId });

    if (user) {
      res.status(201).json({
        success: true,
        message: 'Пользователь создан',
        user
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Ошибка создания пользователя'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

// Логин
app.post('/login', async (req: Request, res: Response) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        message: 'Все поля обязательны.'
      });
    }

    // Используем AS для переименования
    const query = `
      SELECT 
        id, 
        "userName" as "username", 
        email, 
        password, 
        "roleId" as "roleId"
      FROM users 
      WHERE "userName" = $1
    `;

    console.log('Login attempt for:', login);

    const result = await pool.query<User>(query, [login]);

    if (result.rows.length === 0) {
      console.log('User not found:', login);
      return res.status(401).json({
        success: false,
        message: 'Неверный login или пароль.'
      });
    }

    const user = result.rows[0];

    // Детальная отладка
    console.log('User from DB:', user);
    console.log('User ID:', user.id);
    console.log('Role ID from DB:', user.roleId);
    console.log('Role ID type:', typeof user.roleId);

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log('Password mismatch for user:', user.username);
      return res.status(401).json({
        success: false,
        message: 'Неверный login или пароль.'
      });
    }

    // Преобразуем roleId в число на всякий случай
    const roleId = Number(user.roleId);
    console.log('Role ID after conversion:', roleId, 'Type:', typeof roleId);

    // Определяем название роли
    let roleName = 'Пользователь';
    if (roleId === 1) {
      roleName = 'Администратор';
      console.log('Setting role: Administrator');
    } else if (roleId === 2) {
      roleName = 'Поставщик';
      console.log('Setting role: Supplier');
    } else if (roleId === 3) {
      roleName = 'Покупатель';
      console.log('Setting role: Customer');
    }

    console.log('Final role name:', roleName);

    const token = jwt.sign(
      {
        userId: user.id,
        roleId: roleId,
        role: roleName,
        username: user.username
      },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '100h' }
    );

    console.log('Login successful for:', user.username, 'Role:', roleName);

    res.json({
      success: true,
      message: 'Вход успешен!',
      token,
      user: {
        userId: user.id,
        roleId: roleId,
        role: roleName,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера.'
    });
  }
});

// ========== PROTECTED ROUTES (требуется аутентификация) ==========

// Получение профиля пользователя
app.get('/api/user/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

// ========== SUPPLIER ROUTES (только для поставщиков) ==========

// Получение профиля поставщика
app.get('/api/supplier/profile', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const query = `
      SELECT s.*, sc.rating, sc.description 
      FROM suppliers s
      LEFT JOIN "supplierCopies" sc ON s.id = sc."idSupplier"
      WHERE s."userId" = $1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Профиль поставщика не найден'
      });
    }

    res.json({
      success: true,
      supplier: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching supplier profile:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

// Обновление профиля поставщика
app.put('/api/supplier/profile', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { name, description, rating } = req.body;

    // Получаем supplier id
    const supplierQuery = 'SELECT id FROM suppliers WHERE "userId" = $1';
    const supplierResult = await pool.query(supplierQuery, [userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Профиль поставщика не найден'
      });
    }

    const supplierId = supplierResult.rows[0].id;

    // Обновляем основную таблицу
    const updateSupplierQuery = `
      UPDATE suppliers 
      SET name = $1 
      WHERE id = $2 
      RETURNING *
    `;

    const updateResult = await pool.query(updateSupplierQuery, [name, supplierId]);

    // Обновляем или создаем запись в supplierCopies
    const checkCopyQuery = 'SELECT id FROM supplierCopies WHERE "idSupplier" = $1';
    const checkCopyResult = await pool.query(checkCopyQuery, [supplierId]);

    if (checkCopyResult.rows.length > 0) {
      // Обновляем существующую запись
      const updateCopyQuery = `
        UPDATE supplierCopies 
        SET description = $1, rating = $2 
        WHERE "idsupplier" = $3 
        RETURNING *
      `;

      await pool.query(updateCopyQuery, [description, rating, supplierId]);
    } else {
      // Создаем новую запись
      const insertCopyQuery = `
        INSERT INTO supplierCopies (name, "idSupplier", rating, description) 
        VALUES ($1, $2, $3, $4) 
        RETURNING *
      `;

      await pool.query(insertCopyQuery, [name, supplierId, rating, description]);
    }

    res.json({
      success: true,
      message: 'Профиль обновлен',
      supplier: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Error updating supplier profile:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

// Получение участков поставщика
app.get('/api/supplier/places', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    // Получаем supplier id
    const supplierQuery = 'SELECT id FROM suppliers WHERE "userId" = $1';
    const supplierResult = await pool.query(supplierQuery, [userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Профиль поставщика не найден'
      });
    }

    const supplierId = supplierResult.rows[0].id;

    // Получаем все участки поставщика
    const query = `
      SELECT 
        p.id,
        p.address,
        p."kadastrNumber" as "kadastrnumber",
        p.area,
        ST_AsGeoJSON(ST_Transform(p.boundaries, 4326)) as boundaries_geojson
      FROM places p
      INNER JOIN "supplierPlaces" sp ON p.id = sp."idPlace"
      WHERE sp."idSupplier" = $1
      ORDER BY p.id DESC
    `;

    const result = await pool.query(query, [supplierId]);

    const places = result.rows.map(row => ({
      id: row.id,
      address: row.address,
      kadastrnumber: row.kadastrnumber,
      area: parseFloat(row.area),
      boundaries: row.boundaries_geojson ? JSON.parse(row.boundaries_geojson) : null,
      created_at: row.created_at
    }));

    res.json({
      success: true,
      places
    });
  } catch (error) {
    console.error('Error fetching supplier places:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения участков'
    });
  }
});
// Добавление участка поставщику
app.post('/api/supplier/places', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { address, area, boundaries } = req.body;
    const kadastrnumber = req.body.kadastrNumber || req.body.kadastrnumber;

    console.log('=== ADD PLACE REQUEST ===');
    console.log('Received kadastrnumber:', kadastrnumber);
    console.log('Received address:', address);
    console.log('Received area:', area);
    console.log('Received boundaries type:', boundaries?.type);

    // Проверяем обязательные поля
    if (!kadastrnumber) {
      return res.status(400).json({
        success: false,
        message: 'Кадастровый номер обязателен'
      });
    }

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Адрес обязателен'
      });
    }

    // Проверяем, является ли пользователь поставщиком
    const supplierQuery = 'SELECT id FROM suppliers WHERE userId = $1';
    const supplierResult = await pool.query(supplierQuery, [userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Только поставщики могут добавлять участки'
      });
    }

    const supplierId = supplierResult.rows[0].id;

    // Проверяем, существует ли уже участок с таким кадастровым номером
    const checkPlaceQuery = 'SELECT id FROM places WHERE "kadastrNumber" = $1';
    const checkPlaceResult = await pool.query(checkPlaceQuery, [kadastrnumber]);

    let placeId: number;

    if (checkPlaceResult.rows.length > 0) {
      // Участок уже существует в places, используем его id
      placeId = checkPlaceResult.rows[0].id;
      console.log('Place already exists, ID:', placeId);

      // Проверяем, не привязан ли уже этот участок к поставщику
      const checkSupplierPlaceQuery = `
        SELECT id FROM supplierPlaces 
        WHERE "idSupplier" = $1 AND "idPlace" = $2
      `;

      const checkSupplierPlaceResult = await pool.query(
        checkSupplierPlaceQuery,
        [supplierId, placeId]
      );

      if (checkSupplierPlaceResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Этот участок уже добавлен в ваш профиль'
        });
      }
    } else {
      // СОЗДАЕМ НОВЫЙ УЧАСТОК В ТАБЛИЦЕ places
      if (!kadastrnumber.match(/^\d{2}:\d{2}:\d{6,7}:\d+$/)) {
        return res.status(400).json({
          success: false,
          message: 'Неверный формат кадастрового номера'
        });
      }

      // ВАЖНО: ваша таблица places имеет столбцы:
      // id, address, kadastrNumber, area, boundaries
      // boundaries уже имеет тип geometry(POLYGON, 3857)

      const insertPlaceQuery = `
        INSERT INTO places (
          address, 
          "kadastrNumber", 
          area,
          boundaries
        ) 
        VALUES ($1, $2, $3, ST_Transform(ST_GeomFromGeoJSON($4), 3857))
        RETURNING id
      `;

      console.log('Boundaries GeoJSON:', JSON.stringify(boundaries));

      const insertResult = await pool.query(insertPlaceQuery, [
        address,
        kadastrnumber,
        area,
        JSON.stringify(boundaries) // Уже GeoJSON формат
      ]);

      placeId = insertResult.rows[0].id;
      console.log('New place created with ID:', placeId);
    }

    // СВЯЗЫВАЕМ участок с поставщиком в таблице supplierPlaces
    const insertSupplierPlaceQuery = `
      INSERT INTO supplierPlaces ("idSupplier", "idPlace")
      VALUES ($1, $2)
      RETURNING id
    `;

    const supplierPlaceResult = await pool.query(insertSupplierPlaceQuery, [supplierId, placeId]);
    console.log('Supplier-place link created with ID:', supplierPlaceResult.rows[0].id);

    res.status(201).json({
      success: true,
      message: 'Участок успешно добавлен',
      placeId
    });
  } catch (error: any) {
    console.error('Error adding supplier place:', error);
    console.error('Error stack:', error.stack);

    if (error.code === '23505') { // Ошибка уникальности
      return res.status(400).json({
        success: false,
        message: 'Участок с таким кадастровым номером уже существует'
      });
    }

    if (error.code === 'XX000') { // Ошибка PostGIS
      console.error('PostGIS error details:', error);
      return res.status(400).json({
        success: false,
        message: 'Ошибка обработки геометрии участка'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при добавлении участка'
    });
  }
});

// Удаление участка у поставщика
app.delete('/api/supplier/places/:placeId', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { placeId } = req.params;

    // Получаем supplier id
    const supplierQuery = 'SELECT id FROM suppliers WHERE "userId" = $1';
    const supplierResult = await pool.query(supplierQuery, [userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Только поставщики могут управлять участками'
      });
    }

    const supplierId = supplierResult.rows[0].id;

    // Проверяем, принадлежит ли участок этому поставщику
    const checkQuery = `
      SELECT id FROM supplierPlaces 
      WHERE "idSupplier" = $1 AND "idPlace" = $2
    `;

    const checkResult = await pool.query(checkQuery, [supplierId, parseInt(placeId)]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Участок не найден или не принадлежит вам'
      });
    }

    // Удаляем связь
    const deleteQuery = `
      DELETE FROM supplierPlaces 
      WHERE "idSupplier" = $1 AND "idPlace" = $2
    `;

    await pool.query(deleteQuery, [supplierId, parseInt(placeId)]);

    // Проверяем, используется ли участок другими поставщиками
    const checkOtherSuppliersQuery = `
      SELECT COUNT(*) as count 
      FROM supplierPlaces 
      WHERE "idPlace" = $1
    `;

    const otherSuppliersResult = await pool.query(checkOtherSuppliersQuery, [parseInt(placeId)]);

    // Если участок больше никем не используется, можно удалить его полностью
    if (otherSuppliersResult.rows[0].count === 0) {
      await pool.query('DELETE FROM places WHERE id = $1', [parseInt(placeId)]);
    }

    res.json({
      success: true,
      message: 'Участок удален из вашего профиля'
    });
  } catch (error) {
    console.error('Error deleting supplier place:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});
// PUBLIC API
// Публичный список поставщиков
app.get('/api/public/suppliers', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        s.id,
        s.name,
        sc.rating,
        sc.description
      FROM suppliers s
      LEFT JOIN "supplierCopies" sc ON s.id = sc."idSupplier"
      ORDER BY s.id ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      suppliers: result.rows
    });
  } catch (error) {
    console.error('Error fetching public suppliers:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении списка поставщиков'
    });
  }
});

// Публичный список продуктов
app.get('/api/public/products', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        p.id,
        p.name,
        pc.decsription AS description,
        (COALESCE(pc."wholePart", 0) + COALESCE(pc.copecks, 0) / 100.0) AS price,
        d.name AS unit,
        pc.rating
      FROM products p
      LEFT JOIN "productCopies" pc ON p.id = pc."idProduct" AND pc."isActual" = TRUE
      LEFT JOIN "productDimensions" d ON pc."idDimension" = d.id
      ORDER BY p.id ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      products: result.rows
    });
  } catch (error) {
    console.error('Error fetching public products:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении списка продуктов'
    });
  }
});
// Публичный список участков
app.get('/api/public/places', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        p.id,
        p.address,
        p."kadastrNumber",
        p.area,
        ST_AsGeoJSON(ST_Transform(p.boundaries, 4326)) AS boundaries_geojson
      FROM places p
      ORDER BY p.id ASC
    `;

    const result = await pool.query(query);

    const places = result.rows.map(row => ({
      id: row.id,
      address: row.address,
      kadastrnumber: row.kadastrnumber,
      area: parseFloat(row.area),
      boundaries: row.boundaries_geojson ? JSON.parse(row.boundaries_geojson) : null
    }));

    res.json({
      success: true,
      places
    });
  } catch (error) {
    console.error('Error fetching public places:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении списка участков'
    });
  }
});

// ========== ADMIN ROUTES (только для админов) ==========

// Получение всех поставщиков (для админа)
app.get('/api/admin/suppliers', authenticateToken, requireRole(1), async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        s.id,
        s.name,
        s.userid,
        u.username,
        u.email,
        sc.rating,
        sc.description,
        COUNT(sp.id) as places_count
      FROM suppliers s
      LEFT JOIN users u ON s.userid = u.id
      LEFT JOIN supplierCopies sc ON s.id = sc."idsupplier"
      LEFT JOIN supplierPlaces sp ON s.id = sp."idsupplier"
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (
        s.name ILIKE $${paramIndex} OR 
        u.username ILIKE $${paramIndex} OR 
        u.email ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += `
      GROUP BY s.id, u.id, sc.id
      ORDER BY s.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Получаем общее количество
    let countQuery = `
      SELECT COUNT(DISTINCT s.id) as total
      FROM suppliers s
      LEFT JOIN users u ON s.userid = u.id
      WHERE 1=1
    `;

    const countParams = search ? [`%${search}%`] : [];
    if (search) {
      countQuery += ` AND (
        s.name ILIKE $1 OR 
        u.username ILIKE $1 OR 
        u.email ILIKE $1
      )`;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = countResult.rows[0]?.total || 0;

    res.json({
      success: true,
      suppliers: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

// Создание нового поставщика (админом)
app.post('/api/admin/suppliers', authenticateToken, requireRole(1), async (req: Request, res: Response) => {
  try {
    const { name, description, username, email, password } = req.body;

    // Валидация
    if (!name || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Все обязательные поля должны быть заполнены'
      });
    }

    // Проверка уникальности
    const checkQuery = `
      SELECT id FROM users 
      WHERE email = $1 OR username = $2
    `;

    const checkResult = await pool.query(checkQuery, [email, username]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Пользователь с таким email или username уже существует'
      });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Вызов функции PL/pgSQL
    const createQuery = `
      SELECT createUserWithRoleSupplier($1, $2, $3, $4, $5) as userid
    `;

    const result = await pool.query(createQuery, [
      name,
      description || '',
      username,
      email,
      hashedPassword
    ]);

    const createdSupplier = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Поставщик успешно создан',
      data: createdSupplier
    });

  } catch (error: any) {
    console.error('Error creating supplier:', error);

    if (error.message && error.message.includes('already exists')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера при создании поставщика'
      });
    }
  }
});
// server.ts
// ... все ваши импорты и middleware выше ...

// server.ts (фрагмент)
app.post('/api/check-cadastr', authenticateToken, requireRole(2), async (req, res) => {
  try {
    const { kadastrNumber } = req.body;

    if (!kadastrNumber || !kadastrNumber.match(/^\d{2}:\d{2}:\d{6,7}:\d+$/)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный формат кадастрового номера'
      });
    }

    const response = await fetch(
      `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?thematicSearchId=1&query=${kadastrNumber}`,
      {
        headers: {
          Accept: 'application/json',
          Referer: 'https://geodesist.ru/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error checking cadastr:', error);

    const baseLat = 55.7558;
    const baseLon = 37.6173;

    // Мок-данные: координаты в формате [lat, lon]
    const mockData = {
      address: `Москва, тестовый участок ${req.body.kadastrNumber}`,
      area: (Math.random() * 5000 + 1000).toFixed(2),
      category: 'Земли населенных пунктов',
      coordinates: [[
        [baseLat + Math.random() * 0.01, baseLon + Math.random() * 0.01],
        [baseLat + Math.random() * 0.01, baseLon - Math.random() * 0.01],
        [baseLat - Math.random() * 0.01, baseLon - Math.random() * 0.01],
        [baseLat - Math.random() * 0.01, baseLon + Math.random() * 0.01],
        [baseLat + Math.random() * 0.01, baseLon + Math.random() * 0.01]
      ]]
    };

    res.json({
      success: true,
      data: mockData,
      isMock: true
    });
  }
});

// ... остальные маршруты и app.listen ...


// Обновление поставщика (админом)
app.put('/api/admin/suppliers/:id', authenticateToken, requireRole(1), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, rating, email } = req.body;

    // Получаем текущие данные поставщика
    const supplierQuery = `
      SELECT s.id, s."userId"
      FROM suppliers s
      WHERE s.id = $1
    `;

    const supplierResult = await pool.query(supplierQuery, [id]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Поставщик не найден'
      });
    }

    const supplier = supplierResult.rows[0];

    // Обновляем данные
    await pool.query('BEGIN');

    try {
      // Обновляем suppliers
      const updateSupplierQuery = `
        UPDATE suppliers 
        SET name = $1 
        WHERE id = $2
      `;
      await pool.query(updateSupplierQuery, [name, id]);

      // Обновляем supplierCopies
      const updateCopyQuery = `
        UPDATE supplierCopies 
        SET name = $1, description = $2, rating = $3
        WHERE "idSupplier" = $4
      `;
      await pool.query(updateCopyQuery, [name, description, rating, id]);

      // Обновляем email пользователя если изменился
      if (email) {
        const updateUserQuery = `
          UPDATE users 
          SET email = $1 
          WHERE id = $2
        `;
        await pool.query(updateUserQuery, [email, supplier.userid]);
      }

      await pool.query('COMMIT');

      res.json({
        success: true,
        message: 'Данные поставщика обновлены'
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

// Блокировка/разблокировка поставщика (админом)
app.post('/api/admin/suppliers/:id/toggle-status', authenticateToken, requireRole(1), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const supplierQuery = `
      SELECT s."userId"
      FROM suppliers s
      WHERE s.id = $1
    `;

    const supplierResult = await pool.query(supplierQuery, [id]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Поставщик не найден'
      });
    }

    const userId = supplierResult.rows[0].userid;

    // Обновляем статус пользователя
    const updateQuery = `
      UPDATE users 
      SET "isActive" = $1 
      WHERE id = $2
    `;

    await pool.query(updateQuery, [isActive, userId]);

    const statusText = isActive ? 'активирован' : 'деактивирован';

    res.json({
      success: true,
      message: `Поставщик успешно ${statusText}`
    });

  } catch (error) {
    console.error('Error toggling supplier status:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

// ========== ПОЛУЧЕНИЕ СПИСКА ОБЪЕКТОВ ДЛЯ ВЫПАДАЮЩЕГО СПИСКА ==========
// Получить все уникальные названия из namesObjects
// app.get('/api/objects/names', authenticateToken, async (req: Request, res: Response) => {
//   try {
//     const query = `
//            SELECT DISTINCT name, MIN(id) as id
// FROM public."namesObjects" 
// GROUP BY name
// ORDER BY name;
//         `;
//     const result = await pool.query(query);

//     res.json({
//       success: true,
//       data: result.rows.map(r => r.name)
//     });
//   } catch (error) {
//     console.error('Error:', error);
//     res.status(500).json({ success: false, message: 'Ошибка загрузки культур' });
//   }
// });
app.get('/api/objects/names', authenticateToken, async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT DISTINCT name, MIN(id) as id
      FROM public."namesObjects" 
      GROUP BY name
      ORDER BY name;
    `;
    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Ошибка загрузки культур' });
  }
});
app.get('/api/objects/varieties', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Не указано название культуры' });
    }

    const query = `SELECT * FROM get_varieties_by_name($1)`;
    const result = await pool.query(query, [name]);

    res.json({
      success: true,
      data: result.rows  // [{ variety_id: 1, variety_name: "bull_heart" }, ...]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Ошибка загрузки сортов' });
  }
});
app.get('/api/objects', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const query = `
            SELECT 
                no.id,
                no.name as object_name,
                v.id as variety_id,
                v.name as variety_name
            FROM "namesObjects" no
            LEFT JOIN varieties v ON no."idVariety" = v.id
            ORDER BY no.name ASC
        `;

    const result = await pool.query(query);

    res.json({
      success: true,
      objects: result.rows
    });
  } catch (error) {
    console.error('Error fetching objects:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения списка продуктов'
    });
  }
});

// ========== ПОЛУЧЕНИЕ ЕДИНИЦ ИЗМЕРЕНИЯ ==========
// ========== ПОЛУЧЕНИЕ ЕДИНИЦ ИЗМЕРЕНИЯ (для всех авторизованных) ==========
app.get('/api/dimensions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const query = 'SELECT id, name FROM "productDimensions" ORDER BY id';
    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows   // единообразно используем поле data
    });
  } catch (error) {
    console.error('Error fetching dimensions:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения единиц измерения'
    });
  }
});
app.get('/api/dimensions1', async (req: Request, res: Response) => {
  try {
    const query = 'SELECT id, name FROM "productDimensions" ORDER BY id';
    const result = await pool.query(query);

    res.json({
      success: true,
      dimensions: result.rows
    });
  } catch (error) {
    console.error('Error fetching dimensions:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения единиц измерения'
    });
  }
});
app.post('/api/farmer/product-card', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const userId = (req as any).user.userId;

    const {
      cultureId,
      varietyId,
      productName,
      wholepart,
      copecks,
      description,
      weight,
      packaging,
      dimensionId,
      placeId,
      quantity,
      proteines,
      lipides,
      glucides,
      calories,
      joules,
      freshnessId
    } = req.body;

    if (!cultureId || !varietyId || !productName) {
      return res.status(400).json({
        success: false,
        message: 'Культура, сорт и название товара обязательны'
      });
    }

    const supplierResult = await client.query(
      `SELECT id FROM suppliers WHERE "userId" = $1`,
      [userId]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Фермер не найден'
      });
    }

    const supplierId = supplierResult.rows[0].id;

    const objectResult = await client.query(
      `
      SELECT id
      FROM public."namesObjects"
      WHERE id = $1 AND "idVariety" = $2
      LIMIT 1
      `,
      [cultureId, varietyId]
    );

    if (objectResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Культура/сорт не найдены в namesObjects'
      });
    }

    const objectId = objectResult.rows[0].id;

    await client.query('BEGIN');

    const productResult = await client.query(
      `
      INSERT INTO public.products (name, "idObject")
      VALUES ($1, $2)
      RETURNING id
      `,
      [productName, objectId]
    );

    const productId = productResult.rows[0].id;
    const productImagesDir = ensureProductImagesDir(productId);

    await client.query(
      `
      INSERT INTO public."productCopies" (
        "idProduct",
        discount,
        copecks,
        "wholePart",
        decsription,
        "isActual",
        rating,
        "idDimension",
        weight,
        proteines,
        lipides,
        glucides,
        calories,
        joules,
        "releaseDate",
        packaging,
        "idLocationProduct",
        "idFreshness"
      )
      VALUES (
        $1, 0, $2, $3, $4, true, 0.0, $5,
        $6, $7, $8, $9, $10, $11, NOW(), $12, 1, $13
      )
      `,
      [
        productId,
        copecks || 0,
        wholepart || 0,
        description || '',
        dimensionId || 3,
        weight || null,
        proteines || null,
        lipides || null,
        glucides || null,
        calories || null,
        joules || null,
        packaging || null,
        freshnessId || null
      ]
    );

    if (placeId) {
      const supplierPlaceResult = await client.query(
        `
        SELECT id
        FROM public."supplierPlaces"
        WHERE "idSupplier" = $1 AND "idPlace" = $2
        LIMIT 1
        `,
        [supplierId, placeId]
      );

      if (supplierPlaceResult.rows.length === 0) {
        throw new Error('Участок не принадлежит этому фермеру');
      }

      const supplierPlaceId = supplierPlaceResult.rows[0].id;

      await client.query(
        `
        INSERT INTO "supplierPlacesProducts" ("idSupplierPlace", "idProduct")
        VALUES ($1, $2)
        `,
        [supplierPlaceId, productId]
      );
    }

    await client.query('COMMIT');
    notifySupplierWarehouseUpdated(supplierId, {
      action: 'created',
      productId
    });
    return res.status(201).json({
      success: true,
      productId,
      imagesFolder: `/uploads/productsImages/product_${productId}/images`
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating product card:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Ошибка создания товара'
    });
  } finally {
    client.release();
  }
});
const uploadsRoot = path.join(process.cwd(), 'uploads');

function ensureProductImagesDir(productId: number): string {
  const dir = path.join(
    uploadsRoot,
    'productsImages',
    `product_${productId}`,
    'images'
  );

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
}
// ========== HEALTH CHECK ==========
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});
// ========== CATEGORIES ROUTES ==========

// Получение всех категорий продуктов
app.get('/api/categories', authenticateToken, async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        id, 
        name
      FROM "productCategory" 
      ORDER BY name ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      categories: result.rows
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения категорий'
    });
  }
});

// Получение продуктов по категории
app.get('/api/categories/:categoryId/products', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;

    const query = `
      SELECT 
        p.id,
        p.name,
        pc.description,
        pc.rating,
        d.name as unit
      FROM products p
      LEFT JOIN "productCopies" pc ON p.id = pc."idProduct" AND pc."isActual" = true
      LEFT JOIN "productDimensions" d ON pc."idDimension" = d.id
      WHERE p."idCategory" = $1
      ORDER BY p.name ASC
    `;

    const result = await pool.query(query, [categoryId]);

    res.json({
      success: true,
      products: result.rows
    });
  } catch (error) {
    console.error('Error fetching category products:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения продуктов категории'
    });
  }
});
// const mobileCardImageStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const productId = req.params.productId;
//     const dir = path.join(UPLOADS_DIR, 'cards', `card_${productId}`);
//     if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
//     cb(null, dir);
//   },
//   filename: (_req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     cb(null, `photo_${Date.now()}${ext}`);
//   }
// });

// const uploadMobileCardImage = multer({
//   storage: mobileCardImageStorage,
//   limits: { fileSize: 10 * 1024 * 1024 },
//   fileFilter: (_req, file, cb) => {
//     const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
//     if (allowed.includes(file.mimetype)) cb(null, true);
//     else cb(new Error('Неверный формат. Разрешены JPG, PNG, WEBP'));
//   }
// });
const productImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const productId = Number(req.params.productId);

    if (!productId) {
      return cb(new Error('Некорректный productId'), '');
    }

    const dir = ensureProductImagesDir(productId);
    cb(null, dir);
  },

  filename: (req, file, cb) => {
    const productId = Number(req.params.productId);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';

    const safeOriginalName = path
      .parse(file.originalname)
      .name
      .replace(/[^\wа-яА-ЯёЁ-]/g, '_');

    const fileName = `${Date.now()}_${safeOriginalName || `product_${productId}`}${ext}`;

    cb(null, fileName);
  }
});

const uploadProductImage = multer({
  storage: productImageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Неверный формат файла. Разрешены JPG, PNG, WEBP'));
    }
  }
});

app.post(
  '/api/farmer/product-card/:productId/upload-mobile-photo',
  authenticateToken,
  requireRole(2),
  uploadProductImage.single('image'),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const productId = Number(req.params.productId);

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный productId'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Файл не загружен'
        });
      }

      // Проверяем, что товар принадлежит этому поставщику
      const ownerCheck = await pool.query(
        `
  SELECT 
    p.id,
    s.id AS supplier_id
  FROM public.products p
  JOIN public."supplierPlacesProducts" spp ON spp."idProduct" = p.id
  JOIN public."supplierPlaces" sp ON sp.id = spp."idSupplierPlace"
  JOIN public.suppliers s ON s.id = sp."idSupplier"
  WHERE p.id = $1 AND s."userId" = $2
  LIMIT 1
  `,
        [productId, userId]
      );

      if (ownerCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Нет доступа к этому товару'
        });
      }

      const supplierId = Number(ownerCheck.rows[0].supplier_id);

      const imagePath = `/productsImages/product_${productId}/images/${req.file.filename}`;

      await pool.query(
        `
  UPDATE public.products
  SET "imagePath" = $1
  WHERE id = $2
  `,
        [imagePath, productId]
      );

      notifySupplierWarehouseUpdated(supplierId, {
        action: 'photo-uploaded',
        productId
      });

      return res.json({
        success: true,
        message: 'Фото товара загружено',
        imagePath,
        url: imagePath
      });
    } catch (error: any) {
      console.error('Upload product image error:', error);

      return res.status(500).json({
        success: false,
        message: error.message || 'Ошибка загрузки фото'
      });
    }
  }
);
app.get('/api/culture-nutrition/by-pair', authenticateToken, async (req: Request, res: Response) => {
  try {
    const cultureName = String(req.query.cultureName || '');
    const varietyId = Number(req.query.varietyId);

    if (!cultureName || !varietyId) {
      return res.status(400).json({
        success: false,
        message: 'cultureName и varietyId обязательны'
      });
    }

    const result = await pool.query(
      `
      SELECT
        no.id AS "idNameObject",
        no.name,
        no."idVariety",
        COALESCE(cn.calories, 0) AS calories,
        COALESCE(cn.proteines, 0) AS proteines,
        COALESCE(cn.lipides, 0) AS lipides,
        COALESCE(cn.glucides, 0) AS glucides,
        COALESCE(cn.joules, 0) AS joules,
        COALESCE(cn."perGrams", 100) AS "perGrams"
      FROM public."namesObjects" no
      LEFT JOIN public."cultureNutrition" cn
        ON cn."idNameObject" = no.id
      WHERE LOWER(no.name) = LOWER($1)
        AND no."idVariety" = $2
      LIMIT 1
      `,
      [cultureName, varietyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Питание не найдено'
      });
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('culture nutrition error', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});
// ========== SUPPLIER PLACES WITH PRODUCTS ==========
// Получение всех участков поставщика с продуктами
app.get('/api/supplier/places-with-products', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    // Получаем supplier id
    const supplierQuery = 'SELECT id FROM suppliers WHERE "userId" = $1';
    const supplierResult = await pool.query(supplierQuery, [userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Профиль поставщика не найден'
      });
    }

    const supplierId = supplierResult.rows[0].id;

    // Получаем все участки поставщика с продуктами
    const query = `
  SELECT 
        p.id as place_id,
        p.address,
        p."kadastrNumber" as "kadastrNumber",
        p.area,
        ST_AsGeoJSON(ST_Transform(p.boundaries, 4326)) as boundaries_geojson,
        pr.id as product_id,
        pr.name as product_name,
        "productCategory".id as category_id,
        "productCategory".name as category_name,
        no.name as object_name,
        v.name as variety_name
      FROM places p
      INNER JOIN "supplierPlaces" sp ON p.id = sp."idPlace"
      LEFT JOIN "supplierPlacesProducts" spp ON sp.id = spp."idSupplierPlace"
      LEFT JOIN products pr ON spp."idProduct" = pr.id
      LEFT JOIN "productCategories" pc ON pr.id = pc."idProduct"
	  LEFT JOIN "productCategory" ON pc."idCategory" = "productCategory".id
      LEFT JOIN "namesObjects" no ON pr."idObject" = no.id
      LEFT JOIN varieties v ON no."idVariety" = v.id
      WHERE sp."idSupplier" = $1
	  AND "productCategory".id IS NOT NULL
      ORDER BY p.id DESC, pr.name ASC
    `;

    const result = await pool.query(query, [supplierId]);

    // Группируем результаты по участкам
    const placesMap = new Map();

    result.rows.forEach(row => {
      if (!placesMap.has(row.place_id)) {
        placesMap.set(row.place_id, {
          id: row.place_id,
          address: row.address,
          kadastrNumber: row.kadastrNumber,
          area: parseFloat(row.area),
          boundaries: row.boundaries_geojson ? JSON.parse(row.boundaries_geojson) : null,
          products: []
        });
      }

      // Добавляем продукт, если он существует
      if (row.product_id) {
        const place = placesMap.get(row.place_id);
        place.products.push({
          id: row.product_id,
          name: row.product_name,
          categoryId: row.category_id,
          categoryName: row.category_name,
          objectName: row.object_name || 'Без категории',
          varietyName: row.variety_name || '',
          quantity: row.quantity || 1
        });
      }
    });

    const places = Array.from(placesMap.values());

    res.json({
      success: true,
      places
    });

  } catch (error) {
    console.error('Error fetching places with products:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении данных'
    });
  }
});
// ========== SUPPLIER PRODUCTS STATISTICS ==========
// Получение статистики по продуктам поставщика
app.get('/api/supplier/products-statistics', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const query = `
  SELECT 
        p.id as place_id,
        p.address,
        p."kadastrNumber" as "kadastrNumber",
        p.area,
        ST_AsGeoJSON(ST_Transform(p.boundaries, 4326)) as boundaries_geojson,
        pr.id as product_id,
        pr.name as product_name,
        productCategory.id as category_id,
        productCategory.name as category_name,
        no.name as object_name,
        v.name as variety_name
      FROM places p
      INNER JOIN "supplierPlaces" sp ON p.id = sp."idplace"
      LEFT JOIN "supplierPlacesProducts" spp ON sp.id = spp."idsupplierplace"
      LEFT JOIN products pr ON spp."idProduct" = pr.id
      LEFT JOIN productCategories pc ON pr.id = pc."idProduct"
	  LEFT JOIN productCategory ON pc."idCategory" = productCategory.id
      LEFT JOIN "namesObjects" no ON pr."idObject" = no.id
      LEFT JOIN varieties v ON no."idVariety" = v.id
      WHERE sp."idSupplier" = $1
	  AND productCategory.id IS NOT NULL
      ORDER BY p.id DESC, pr.name ASC
    `;

    const result = await pool.query(query, [userId]);

    res.json({
      success: true,
      statistics: result.rows
    });

  } catch (error) {
    console.error('Error fetching products statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении статистики'
    });
  }
});

// backend/src/routes/buyer.routes.ts
// ========== BUYER ROUTES ==========
// Получение всех фермеров с их участками и продукцией для карты
app.get('/api/buyer/farmers-map', authenticateToken, requireRole(3), async (req: Request, res: Response) => {
  try {
    const query = `
     WITH farmer_data AS (
    SELECT 
        s.id AS supplier_id,
        s.name AS farmer_name,
        sc.rating
    FROM suppliers s
    INNER JOIN "supplierCopies" sc ON sc."idSupplier" = s.id
    WHERE sc."isActual" = true
),
farmer_places AS (
    SELECT 
        fd.supplier_id,
        fd.farmer_name,
        fd.rating,
        p.id AS place_id,
        p.address,
        p."kadastrNumber",
        p.area,
        ST_AsGeoJSON(ST_Transform(p.boundaries, 4326)) AS boundaries_geojson
    FROM farmer_data fd
    INNER JOIN "supplierPlaces" sp ON fd.supplier_id = sp."idSupplier"
    INNER JOIN places p ON sp."idPlace" = p.id
),
place_products AS (
    SELECT 
        fp.place_id,
        fp.supplier_id,
        fp.farmer_name,
        fp.rating,
        fp.address,
        fp."kadastrNumber",
        fp.area,
        fp.boundaries_geojson,
        pr.id AS product_id,
        pr.name AS product_name,
        cat.id AS category_id,
        cat.name AS category_name,
        no.name AS object_name,
        v.name AS variety_name
    FROM farmer_places fp
    LEFT JOIN "supplierPlacesProducts" spp ON fp.place_id = spp."idSupplierPlace"
    LEFT JOIN products pr ON spp."idProduct" = pr.id
    LEFT JOIN "productCategories" pc ON pr.id = pc."idProduct"
    LEFT JOIN "productCategory" cat ON pc."idCategory" = cat.id
    LEFT JOIN "namesObjects" no ON pr."idObject" = no.id
    LEFT JOIN varieties v ON no."idVariety" = v.id
    WHERE cat.id IS NOT NULL
)
SELECT * FROM place_products
ORDER BY supplier_id, place_id, product_name;
    `;

    const result = await pool.query(query);

    // Группируем по фермерам и их участкам
    const farmersMap = new Map();

    result.rows.forEach(row => {
      // Группировка по фермерам
      if (!farmersMap.has(row.supplier_id)) {
        farmersMap.set(row.supplier_id, {
          id: row.supplier_id,
          name: row.farmer_name,
          rating: row.rating,
          places: new Map()
        });
      }

      const farmer = farmersMap.get(row.supplier_id);

      // Группировка по участкам фермера
      if (!farmer.places.has(row.place_id)) {
        farmer.places.set(row.place_id, {
          id: row.place_id,
          address: row.address,
          kadastrNumber: row.kadastrNumber,
          area: parseFloat(row.area),
          boundaries: row.boundaries_geojson ? JSON.parse(row.boundaries_geojson) : null,
          products: []
        });
      }

      // Добавляем продукт, если он существует
      if (row.product_id) {
        const place = farmer.places.get(row.place_id);
        place.products.push({
          id: row.product_id,
          name: row.product_name,
          categoryId: row.category_id,
          categoryName: row.category_name,
          objectName: row.object_name || 'Без категории',
          varietyName: row.variety_name || ''
        });
      }
    });

    // Преобразуем Map в массив для отправки
    const farmers = Array.from(farmersMap.values()).map(farmer => ({
      id: farmer.id,
      name: farmer.name,
      rating: farmer.rating,
      places: Array.from(farmer.places.values())
    }));

    res.json({
      success: true,
      farmers
    });

  } catch (error) {
    console.error('Error fetching farmers map data:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении данных фермеров'
    });
  }
});

// Получение детальной информации о фермере
app.get('/api/buyer/farmer/:farmerId/details', authenticateToken, requireRole(3), async (req: Request, res: Response) => {
  try {
    const { farmerId } = req.params;

    const query = `
        SELECT 
        s.id as supplier_id,
        u.id as user_id,
        s.name as farmer_name,
        "supplierCopies".rating,
        "supplierCopies".description
      FROM suppliers s
	  JOIN "supplierCopies" ON "supplierCopies"."idSupplier" = s.id
      INNER JOIN users u ON s."userId" = u.id
      WHERE s.id = $1
    `;

    const result = await pool.query(query, [farmerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Фермер не найден'
      });
    }

    res.json({
      success: true,
      farmer: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching farmer details:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении данных фермера'
    });
  }
});

app.get('/api/buyer/farmers-map', authenticateToken, requireRole(3), async (req: Request, res: Response) => {
  try {
    const query = `
      WITH farmer_data AS (
        SELECT 
          s.id as supplier_id,
          u.id as user_id,
          u.name as farmer_name,
          u.login as farmer_login,
          s.rating,
          s."createdAt"
        FROM suppliers s
        INNER JOIN users u ON s."userId" = u.id
        WHERE u."roleId" = 2 -- роль поставщика
      ),
      farmer_places AS (
        SELECT 
          fd.supplier_id,
          fd.farmer_name,
          fd.rating,
          p.id as place_id,
          p.address,
          p."kadastrnumber" as "kadastrNumber",
          p.area,
          ST_AsGeoJSON(ST_Transform(p.boundaries, 4326)) as boundaries_geojson
        FROM farmer_data fd
        INNER JOIN supplierPlaces sp ON fd.supplier_id = sp."idsupplier"
        INNER JOIN places p ON sp."idplace" = p.id
      ),
      place_products AS (
        SELECT 
          fp."placeId" as "place_id",
          fp.supplierId as "supplier_id",
          fp.farmerName as "farmer_name",
          fp.rating,
          fp.address,
          fp."kadastrNumber",
          fp.area,
          fp.boundaries_geojson,
          pr.id as product_id,
          pr.name as product_name,
          productCategory.id as category_id,
          productCategory.name as category_name,
          no.name as object_name,
          v.name as variety_name,
          spp.quantity
        FROM farmer_places fp
        LEFT JOIN "supplierPlacesProducts" spp ON fp.place_id = spp."idplace"
        LEFT JOIN products pr ON spp."idproduct" = pr.id
        LEFT JOIN productCategories pc ON pr.id = pc.idproduct
        LEFT JOIN productCategory ON pc.idcategory = productCategory.id
        LEFT JOIN "namesObjects" no ON pr."idobject" = no.id
        LEFT JOIN varieties v ON no."idvariety" = v.id
        WHERE productCategory.id IS NOT NULL
      )
      SELECT * FROM place_products
      ORDER BY supplier_id, place_id, product_name
    `;

    const result = await pool.query(query);

    // Группируем по фермерам и их участкам
    const farmersMap = new Map();

    result.rows.forEach(row => {
      // Группировка по фермерам
      if (!farmersMap.has(row.supplier_id)) {
        farmersMap.set(row.supplier_id, {
          id: row.supplier_id,
          name: row.farmer_name,
          rating: row.rating,
          places: new Map()
        });
      }

      const farmer = farmersMap.get(row.supplier_id);

      // Группировка по участкам фермера
      if (!farmer.places.has(row.place_id)) {
        farmer.places.set(row.place_id, {
          id: row.place_id,
          address: row.address,
          kadastrNumber: row.kadastrNumber,
          area: parseFloat(row.area),
          boundaries: row.boundaries_geojson ? JSON.parse(row.boundaries_geojson) : null,
          products: []
        });
      }

      // Добавляем продукт, если он существует
      if (row.product_id) {
        const place = farmer.places.get(row.place_id);
        place.products.push({
          id: row.product_id,
          name: row.product_name,
          categoryId: row.category_id,
          categoryName: row.category_name,
          objectName: row.object_name || 'Без категории',
          varietyName: row.variety_name || '',
          quantity: row.quantity || 1
        });
      }
    });

    // Преобразуем Map в массив для отправки
    const farmers = Array.from(farmersMap.values()).map(farmer => ({
      id: farmer.id,
      name: farmer.name,
      rating: farmer.rating,
      places: Array.from(farmer.places.values())
    }));

    res.json({
      success: true,
      farmers
    });

  } catch (error) {
    console.error('Error fetching farmers map data:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении данных фермеров'
    });
  }
});


// ========== WAREHOUSE ROUTES ==========

// Получение всех товаров на складе поставщика
app.get('/api/supplier/warehouse', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    // Получаем supplier id
    const supplierQuery = 'SELECT id FROM suppliers WHERE "userId" = $1';
    const supplierResult = await pool.query(supplierQuery, [userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Профиль поставщика не найден'
      });
    }

    const supplierId = supplierResult.rows[0].id;

    const query = `
      SELECT 
        pc.id,
        pc."idProduct" as idproduct,
        pc.discount,
        pc.copecks,
        pc."idLocationProduct" as idlocationproduct,
        pc."wholePart" as wholepart,
        pc.decsription,
        pc."isActual" as isactual,
        pc.rating,
        pc."idDimension" as iddimension,
        pc.weight,
        p."imagePath" as product_imagepath,
        pc.proteines,
        pc.lipides,
        pc.glucides,
        pc.calories,
        pc.joules,
        pc."expirationDate" as expirationdate,
        pc."releaseDate" as releasedate,
        pc.packaging,
        pc."placeOfOrigin" as placeoforigin,
        p.id as product_id,
        p.name as product_name,
        no.id as object_id,
        no.name as object_name,
        v.id as variety_id,
        v.name as variety_name,
        cat.id as category_id,
        cat.name as category_name,
        pl.id as place_id,
        pl.address as place_address,
        pl."kadastrNumber" as place_kadastr
      FROM "supplierPlacesProducts" spp
      JOIN "supplierPlaces" sp ON spp."idSupplierPlace" = sp.id
      JOIN products p ON spp."idProduct" = p.id
	    JOIN "productCopies" pc ON spp."idProduct" = pc.id
      LEFT JOIN "namesObjects" no ON p."idObject" = no.id
      LEFT JOIN varieties v ON no."idVariety" = v.id
      LEFT JOIN "productCategories" pcats ON p.id = pcats."idProduct"
      LEFT JOIN "productCategory" cat ON pcats."idCategory" = cat.id
      LEFT JOIN places pl ON sp."idPlace" = pl.id
      WHERE sp."idSupplier" = $1 AND pc."isActual" = true
      ORDER BY pc.id DESC
    `;

    const result = await pool.query(query, [supplierId]);

    const products = result.rows.map(row => ({
      id: row.id,
      idproduct: row.idproduct,
      discount: row.discount,
      copecks: row.copecks,
      wholepart: row.wholepart,
      decsription: row.decsription,
      isactual: row.isactual,
      rating: row.rating,
      imagePath: row.product_imagepath,
      idlocationproduct: row.idlocationproduct,
      iddimension: row.iddimension,
      weight: row.weight,
      proteines: row.proteines,
      lipides: row.lipides,
      glucides: row.glucides,
      calories: row.calories,
      joules: row.joules,
      expirationdate: row.expirationdate,
      releasedate: row.releasedate,
      packaging: row.packaging,
      placeoforigin: row.placeoforigin,
      product: {
        id: row.product_id,
        name: row.product_name,
        objectName: row.object_name,
        varietyName: row.variety_name,
        categoryName: row.category_name
      },
      place: row.place_id ? {
        id: row.place_id,
        address: row.place_address,
        kadastrNumber: row.place_kadastr
      } : null
    }));

    res.json({
      success: true,
      products
    });

  } catch (error) {
    console.error('Error fetching warehouse:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении данных склада'
    });
  }
});

// Обновление товара
app.put('/api/supplier/warehouse/:id', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { wholepart, copecks, discount } = req.body;

    const query = `
      UPDATE "productCopies" 
      SET "wholePart" = $1, copecks = $2, discount = $3
      WHERE id = $4
      RETURNING id
    `;

    const result = await pool.query(query, [wholepart, copecks, discount, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Товар не найден'
      });
    }

    res.json({
      success: true,
      message: 'Товар обновлен'
    });

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при обновлении товара'
    });
  }
});

// Удаление товара
app.delete('/api/supplier/warehouse/:id', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Удаляем связь в supplierPlacesProducts
    await pool.query('DELETE FROM "supplierPlacesProducts" WHERE "idProductCopy" = $1', [id]);

    // Удаляем сам товар
    const result = await pool.query('DELETE FROM "productCopies" WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Товар не найден'
      });
    }

    res.json({
      success: true,
      message: 'Товар удален'
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при удалении товара'
    });
  }
});

// ========== AUCTION ROUTES ==========

// Получение всех аукционов поставщика
app.get('/api/supplier/auctions', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    // Получаем supplier id
    const supplierQuery = 'SELECT id FROM suppliers WHERE "userId" = $1';
    const supplierResult = await pool.query(supplierQuery, [userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Профиль поставщика не найден'
      });
    }

    const supplierId = supplierResult.rows[0].id;

    const query = `
      SELECT 
        a.id,
        a."lotNumber" as "lotNumber",
        a.title,
        a.description,
        a."idProduct" as idProduct,
        a."startPrice" as startprice,
        a."minStep" as minstep,
        a."buyNowPrice" as buynowprice,
        a.characteristics,
        a."deliveryRegion" as deliveryregion,
        a."idPlace" as idplace,
        a."startTime" as starttime,
        a."endTime" as endtime,
        a."createdAt" as createdat,
        a.vatincluded,
        ah.status,
        ah."isActive" as isactive,
        p.name as "productName",
        pc.name as "categoryName",
        no.name as "objectName",
        v.name as "varietyName",
        pl.address as "placeAddress",
        (SELECT COUNT(*) FROM "auctionBids" WHERE "idAuction" = a.id) as "bidsCount",
        (SELECT "bidAmountWhole" as bidamountwhole FROM "auctionBids" WHERE "idAuction" = a.id ORDER BY bidamountwhole DESC LIMIT 1) as "currentBid"
      FROM auctions a
      LEFT JOIN "auctionHistory" ah ON a.id = ah."idAuction" AND ah."isActive" = true
      LEFT JOIN products p ON a."idProduct" = p.id
      LEFT JOIN "productCategories" pcats ON p.id = pcats."idProduct"
      LEFT JOIN "productCategory" pc ON pcats."idCategory" = pc.id
      LEFT JOIN "namesObjects" no ON p."idObject" = no.id
      LEFT JOIN varieties v ON no."idVariety" = v.id
      LEFT JOIN "supplierPlaces" sp ON a."idPlace" = sp.id
      LEFT JOIN places pl ON sp."idPlace" = pl.id
      WHERE a."idSupplier" = $1
      ORDER BY a."createdAt" DESC
    `;

    const result = await pool.query(query, [supplierId]);

    res.json({
      success: true,
      auctions: result.rows
    });

  } catch (error) {
    console.error('Error fetching auctions:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении аукционов'
    });
  }
});

// Получение продуктов, доступных для аукциона (auctionProduct = true)
app.get('/api/supplier/auction-products', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const query = `
       SELECT 
        pc.id,
        pc."idProduct" as "productId",
        p.name as "productName",
        no.name as "objectName",
        v.name as "varietyName",
        pc."wholePart" as wholepart,
        pc.copecks,
        d.name as "unit"
      FROM "productCopies" pc
      INNER JOIN products p ON pc."idProduct" = p.id
      LEFT JOIN "productCategories" pcats ON p.id = pcats."idProduct"
      LEFT JOIN "productCategory" cat ON pcats."idCategory" = cat.id
      LEFT JOIN "namesObjects" no ON p."idObject" = no.id
      LEFT JOIN varieties v ON no."idVariety" = v.id
      LEFT JOIN "productDimensions" d ON pc."idDimension" = d.id
      LEFT JOIN "locationProduct" ON pc."idLocationProduct" = "locationProduct".id
      WHERE "locationProduct".id = 2
      ORDER BY p.name ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      products: result.rows
    });

  } catch (error) {
    console.error('Error fetching auction products:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении продуктов'
    });
  }
});

// Создание нового аукциона
app.post('/api/supplier/auctions', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const {
      title,
      description,
      idproduct,
      startprice,
      minstep,
      buynowprice,
      starttime,
      endtime,
      vatincluded,
      deliveryregion,
      idplace
    } = req.body;

    // Валидация
    if (!title || !idproduct || !startprice || !minstep || !starttime || !endtime || !deliveryregion || !idplace) {
      return res.status(400).json({
        success: false,
        message: 'Заполните все обязательные поля'
      });
    }

    // Получаем supplier id
    const supplierQuery = 'SELECT id FROM suppliers WHERE "userId" = $1';
    const supplierResult = await pool.query(supplierQuery, [userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Профиль поставщика не найден'
      });
    }

    const supplierId = supplierResult.rows[0].id;

    // Генерируем номер лота
    const lotNumber = `AUCT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

    // Получаем характеристики товара из productcopies
    const productQuery = 'SELECT characteristics FROM "productCopies" WHERE id = $1';
    const productResult = await pool.query(productQuery, [idproduct]);
    const characteristics = productResult.rows[0]?.characteristics || {};

    // Начинаем транзакцию
    await pool.query('BEGIN');

    try {
      // Создаем аукцион
      const auctionQuery = `
    INSERT INTO auctions (
    "idSupplier",
    "lotNumber",
    "title",
    "description",
    "idProduct",
    "startPrice",
    "minStep",
    "buyNowPrice",
    "characteristics",
    "deliveryRegion",
    "idPlace",
    "startTime",
    "endTime",
    "vatIncluded"
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING "id"
      `;

      const auctionResult = await pool.query(auctionQuery, [
        supplierId,
        lotNumber,
        title,
        description || '',
        idproduct,
        startprice,
        minstep,
        buynowprice || null,
        characteristics,
        deliveryregion,
        idplace,
        starttime,
        endtime,
        vatincluded
      ]);

      const auctionId = auctionResult.rows[0].id;

      // Создаем запись в истории статусов
      const historyQuery = `
        INSERT INTO "auctionHistory" ("idAuction", "changedBy", status)
        VALUES ($1, $2, $3)
      `;

      await pool.query(historyQuery, [auctionId, userId, 'draft']);

      await pool.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Аукцион успешно создан',
        auctionId,
        lotNumber
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error creating auction:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при создании аукциона'
    });
  }
});

// Изменение статуса аукциона
app.put('/api/supplier/auctions/:id/status', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = (req as any).user.userId;

    // Проверяем, существует ли аукцион и принадлежит ли он поставщику
    const checkQuery = `
      SELECT a.* FROM auctions a
      INNER JOIN suppliers s ON a."idSupplier" = s.id
      WHERE a.id = $1 AND s."userId" = $2
    `;

    const checkResult = await pool.query(checkQuery, [id, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Аукцион не найден'
      });
    }

    // Деактивируем предыдущую запись в истории
    await pool.query(`
      UPDATE "auctionHistory" 
      SET "isActive" = false 
      WHERE "idAuction" = $1
    `, [id]);

    // Создаем новую запись в истории
    const historyQuery = `
      INSERT INTO "auctionHistory" ("idAuction", "changedBy", status)
      VALUES ($1, $2, $3)
      RETURNING id
    `;

    await pool.query(historyQuery, [id, userId, status]);

    res.json({
      success: true,
      message: 'Статус аукциона обновлен'
    });

  } catch (error) {
    console.error('Error updating auction status:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при обновлении статуса'
    });
  }
});

// Получение ставок аукциона
app.get('/api/supplier/auctions/:id/bids', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Проверяем, принадлежит ли аукцион поставщику
    const checkQuery = `
      SELECT a.* FROM auctions a
      INNER JOIN suppliers s ON a."idSupplier" = s.id
      WHERE a.id = $1 AND s."userId" = $2
    `;

    const checkResult = await pool.query(checkQuery, [id, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Аукцион не найден'
      });
    }

    // Получаем ставки
    const bidsQuery = `
    SELECT 
    b.id,
    b."bidAmountWhole" AS bidamountwhole,
    b."bidAmountCopecks" AS bidamountcopecks,
    b."bidTime" AS bidtime,
    b."isWinning" AS iswinning,
    u."userName" as username
FROM "auctionBids" b
INNER JOIN users u ON b."idUser" = u.id
WHERE b."idAuction" = $1
ORDER BY b."bidAmountWhole" DESC, b."bidTime" DESC
    `;

    const result = await pool.query(bidsQuery, [id]);

    res.json({
      success: true,
      bids: result.rows
    });

  } catch (error) {
    console.error('Error fetching bids:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении ставок'
    });
  }
});

// Удаление аукциона (только если статус draft или cancelled)
app.delete('/api/supplier/auctions/:id', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Проверяем статус аукциона
    const checkQuery = `
    SELECT ah.status FROM auctions a
INNER JOIN suppliers s ON a."idSupplier" = s.id
LEFT JOIN "auctionHistory" ah ON a.id = ah."idAuction" AND ah."isActive" = true
WHERE a.id = $1 AND s."userId" = $2
    `;

    const checkResult = await pool.query(checkQuery, [id, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Аукцион не найден'
      });
    }

    const status = checkResult.rows[0].status;

    if (status !== 'draft' && status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Можно удалить только черновики или отмененные аукционы'
      });
    }

    // Удаляем аукцион (каскадно удалятся ставки и история)
    await pool.query('DELETE FROM auctions WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Аукцион успешно удален'
    });

  } catch (error) {
    console.error('Error deleting auction:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при удалении аукциона'
    });
  }
});
// Перемещение товара между статусами (склад/рынок/аукцион)
app.put('/api/supplier/warehouse/:id/move', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newLocation } = req.body;
    const userId = (req as any).user.userId;

    // Проверяем, принадлежит ли товар поставщику
    const checkQuery = `
   SELECT pc.* 
FROM "productCopies" pc
INNER JOIN "supplierPlacesProducts" spp ON pc.id = spp."idProduct"
INNER JOIN "supplierPlaces" sp ON spp."idSupplierPlace" = sp.id
INNER JOIN suppliers s ON sp."idSupplier" = s.id
WHERE pc.id = $1 AND s."userId" = $2
    `;

    const checkResult = await pool.query(checkQuery, [id, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Товар не найден'
      });
    }

    // Обновляем местоположение
    const updateQuery = `
   UPDATE "productCopies" 
SET "idLocationProduct" = $1 
WHERE id = $2
RETURNING id
    `;

    const result = await pool.query(updateQuery, [newLocation, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Товар не найден'
      });
    }

    const locationNames = {
      1: 'склад',
      2: 'рынок',
      3: 'аукцион'
    };

    res.json({
      success: true,
      message: `Товар перемещен на ${locationNames[newLocation as keyof typeof locationNames]}`,
      newLocation
    });

  } catch (error) {
    console.error('Error moving product:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при перемещении товара'
    });
  }
});
// ========== MARKET ROUTES ==========

// Получение товаров на рынке (idlocationproduct = 2 и isactual = true)
// Получение товаров на рынке (только для конкретного поставщика)
app.get('/api/supplier/market/products', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    // Получаем supplier id
    const supplierQuery = 'SELECT id FROM suppliers WHERE "userId" = $1';
    const supplierResult = await pool.query(supplierQuery, [userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Профиль поставщика не найден'
      });
    }

    const supplierId = supplierResult.rows[0].id;

    const query = `
     	SELECT 
    pc.id,
    pc."idProduct",
    pc.discount,
    pc.copecks,
    pc."wholePart",
    pc.decsription,          -- исправлено "decsription"
    pc."isActual",
    pc.rating,
    pc."idDimension",
    pc.weight,
    pc.proteines,
    pc.lipides,
    pc.glucides,
    pc.calories,
    pc.joules,
    pc."expirationDate",
    pc."releaseDate",
    pc.packaging,
    pc."placeOfOrigin",
    pc."idLocationProduct",
    purchases.id AS purchase_id,
    p.id AS product_id,
    p.name AS product_name,
    no.id AS object_id,
    no.name AS object_name,
    v.id AS variety_id,
    v.name AS variety_name,
    cat.id AS category_id,
    cat.name AS category_name,
    pl.id AS place_id,
    pl.address AS place_address,
    pl."kadastrNumber" AS place_kadastr
FROM "productCopies" pc
JOIN products p ON pc."idProduct" = p.id
LEFT JOIN "namesObjects" no ON p."idObject" = no.id
LEFT JOIN varieties v ON no."idVariety" = v.id
LEFT JOIN "productCategories" pcats ON p.id = pcats."idProduct"
LEFT JOIN "productCategory" cat ON pcats."idCategory" = cat.id
LEFT JOIN "supplierPlacesProducts" spp ON pc.id = spp."idProduct"
LEFT JOIN "supplierPlaces" sp ON spp."idSupplierPlace" = sp.id
LEFT JOIN places pl ON sp."idPlace" = pl.id
LEFT JOIN suppliers s ON sp."idSupplier" = s.id AND s.id = $1
LEFT JOIN purchases ON p.id = purchases."idProduct"
WHERE pc."isActual" = true 
  AND pc."idLocationProduct" = 1
  AND purchases.id IS NULL
ORDER BY pc.id DESC
    `;

    const result = await pool.query(query, [supplierId]);

    const products = result.rows.map(row => ({
      id: row.id,
      idproduct: row.idproduct,
      discount: row.discount,
      copecks: row.copecks,
      wholepart: row.wholepart,
      decsription: row.decsription,
      isactual: row.isactual,
      rating: row.rating,
      iddimension: row.iddimension,
      weight: row.weight,
      proteines: row.proteines,
      lipides: row.lipides,
      glucides: row.glucides,
      calories: row.calories,
      joules: row.joules,
      expirationdate: row.expirationdate,
      releasedate: row.releasedate,
      packaging: row.packaging,
      placeoforigin: row.placeoforigin,
      idlocationproduct: row.idlocationproduct,
      product: {
        id: row.product_id,
        name: row.product_name,
        objectName: row.object_name,
        varietyName: row.variety_name,
        categoryName: row.category_name
      },
      place: row.place_id ? {
        id: row.place_id,
        address: row.place_address,
        kadastrNumber: row.place_kadastr
      } : null
    }));

    res.json({
      success: true,
      products
    });

  } catch (error) {
    console.error('Error fetching market products:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении товаров'
    });
  }
});

// Получение истории покупок для поставщика
app.get('/api/supplier/market/purchases', authenticateToken, requireRole(2), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    // Получаем supplier id
    const supplierQuery = 'SELECT id FROM suppliers WHERE "userId" = $1';
    const supplierResult = await pool.query(supplierQuery, [userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Профиль поставщика не найден'
      });
    }

    const supplierId = supplierResult.rows[0].id;

    const query = `
     SELECT 
    p.*,
    u."userName",
    u.email,
    pl.address AS place_address
FROM purchases p
LEFT JOIN users u ON p."idCustomer" = u.id
LEFT JOIN places pl ON p."idPlace" = pl.id
WHERE p."idSupplier" = $1
ORDER BY p."createdAt" DESC
    `;
    const result = await pool.query(query, [supplierId]);

    const purchases = result.rows.map(row => ({
      id: row.id,
      idproductcopy: row.idproductcopy,
      idsupplier: row.idsupplier,
      idcustomer: row.idcustomer,
      idplace: row.idplace,
      quantity: row.quantity,
      totalprice: row.totalprice,
      status: row.status,
      paymentmethod: row.paymentmethod,
      deliveryaddress: row.deliveryaddress,
      contactphone: row.contactphone,
      contactemail: row.contactemail,
      comment: row.comment,
      createdat: row.createdat,
      completedat: row.completedat,
      customer: row.idcustomer ? {
        id: row.idcustomer,
        username: row.username,
        email: row.email
      } : null,
      place: row.idplace ? {
        id: row.idplace,
        address: row.place_address
      } : null
    }));

    res.json({
      success: true,
      purchases
    });

  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении истории покупок'
    });
  }
});

// Создание покупки (для покупателя)
app.post('/api/supplier/market/purchase', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const {
      idproductcopy,
      quantity,
      paymentmethod,
      deliveryaddress,
      contactphone,
      contactemail,
      comment
    } = req.body;

    // Получаем информацию о товаре
    const productQuery = `
     SELECT 
    pc.*,
    sp."idSupplier",
    sp."idPlace"
FROM "productCopies" pc
INNER JOIN "supplierPlacesProducts" spp ON pc.id = spp."idProductCopy"
INNER JOIN "supplierPlaces" sp ON spp."idSupplierPlace" = sp.id
WHERE pc.id = $1
    `;

    const productResult = await pool.query(productQuery, [idproductcopy]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Товар не найден'
      });
    }

    const product = productResult.rows[0];
    const totalprice = (product.wholepart + product.copecks / 100) * quantity;

    // Создаем покупку
    const insertQuery = `
     INSERT INTO "purchases" (
    "idProductCopy",
    "idSupplier",
    "idCustomer",
    "idPlace",
    "quantity",
    "totalPrice",
    "paymentMethod",
    "deliveryAddress",
    "contactPhone",
    "contactEmail",
    "comment",
    "status"
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
RETURNING "id"
    `;

    const result = await pool.query(insertQuery, [
      idproductcopy,
      product.idsupplier,
      userId,
      product.idplace,
      quantity,
      totalprice,
      paymentmethod,
      deliveryaddress,
      contactphone,
      contactemail,
      comment
    ]);

    // Здесь можно добавить отправку уведомлений поставщику

    res.status(201).json({
      success: true,
      message: 'Покупка успешно оформлена',
      purchaseId: result.rows[0].id
    });

  } catch (error) {
    console.error('Error creating purchase:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при оформлении покупки'
    });
  }
});

// backend/src/routes/buyer.routes.ts (дополнение)

// Интерфейс для координат пользователя
interface UserLocation {
  lat: number;
  lng: number;
}
// Сохранение адреса доставки покупателя
app.post('/api/buyer/delivery-address', authenticateToken, requireRole(3), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { address } = req.body;

    console.log('Saving delivery address for user:', userId);
    console.log('Address data:', { address });

    // Проверяем, существует ли покупатель
    const checkQuery = 'SELECT id FROM customers WHERE "idUser" = $1'; // БЫЛО $2, ИСПРАВИЛ НА $1
    const checkResult = await pool.query(checkQuery, [userId]);

    if (checkResult.rows.length > 0) {
      // Обновляем существующего покупателя
      const updateQuery = `
        UPDATE customers 
        SET "deliveryAddress" = $1
        WHERE "idUser" = $2
      `;

      await pool.query(updateQuery, [address, userId]);
      console.log('Updated existing customer address');
    }

    res.json({
      success: true,
      message: 'Адрес доставки сохранен'
    });
  } catch (error) {
    console.error('Error saving delivery address:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сохранения адреса'
    });
  }
});

// Получение адреса доставки покупателя
app.get('/api/buyer/delivery-address', authenticateToken, requireRole(3), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const query = `
      SELECT "deliveryAddress" as deliveryaddress
      FROM customers 
      WHERE "idUser" = $1
    `;

    const result = await pool.query(query, [userId]);

    res.json({
      success: true,
      address: result.rows[0] || null
    });
  } catch (error) {
    console.error('Error fetching delivery address:', error);
    res.status(500).json({ success: false, message: 'Ошибка получения адреса' });
  }
});

// Получение статистики для покупателя
app.get('/api/buyer/stats', authenticateToken, requireRole(3), async (req: Request, res: Response) => {
  try {
    const stats = {
      farmersCount: 0,
      productsCount: 0,
      categoriesCount: 0
    };

    // Получаем количество фермеров
    const farmersResult = await pool.query(`
      SELECT COUNT(DISTINCT s.id) as count
      FROM suppliers s
      INNER JOIN "supplierCopies" sc ON s.id = sc."idSupplier"
      WHERE sc."isActual" = true
    `);
    stats.farmersCount = parseInt(farmersResult.rows[0]?.count || '0');

    // Получаем количество продуктов
    const productsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM "productCopies"
      WHERE "isActual" = true
    `);
    stats.productsCount = parseInt(productsResult.rows[0]?.count || '0');

    // Получаем количество категорий
    const categoriesResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM "productCategory"
    `);
    stats.categoriesCount = parseInt(categoriesResult.rows[0]?.count || '0');

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching buyer stats:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статистики'
    });
  }
});


// ===============================
// TYPES
// ===============================
const useAdaptiveClustering = false;

interface Coorinate {
  lat: number;
  lng: number;
}

interface PlaceItem {
  placeId: number;
  farmerId: number;
  farmerName: string;
  avatar_url: string;
  image_place_url: string;
  rating: number;
  subscriptionScore: number;
  subscriptionDuration?: number;
  distance: number;
  address: string;
  coordinates: { lat: number; lng: number };
  is_subscribed: boolean;
  userid: number;  // добавляем
  has_eco_certificate: boolean;  // Добавляем - true/false
  productCount: number;            // количество продуктов на участке
  productCategories?: string[];
  products?: { id: string; name: string; objectName: string; isCategoryFallback?: boolean }[];
}

interface Cluster {
  id: number;
  points: PlaceItem[];
  size: number;
  avgDistance: number;
  avgRating: number;
  subscriptionRate: number;
  rank: number;
  rankScore: number;
  rankColor: string;
}

interface RankedPlace extends PlaceItem {
  clusterId: number;
  clusterRank: number;
  clusterRankColor: string;
  productCount: number;
  productCategories?: string[];
  individualScore: number;
}

interface RankedFarmerPlace {
  id: number;
  address: string;
  productCount: number;
  image_url: string;
  productCategories?: string[];
  distance: number;
  products?: { id: string; name: string; objectName: string; isCategoryFallback?: boolean }[];
  individualScore: number;
  clusterId: number;
  clusterRank: number;
}

interface RankedFarmer {
  id: number;
  name: string;
  rating: number;
  distance: number | null;
  is_subscribed: boolean;
  clusterId: number;
  userid: number;  // добавляем
  clusterRank: number;
  clusterRankColor: string;
  individualScore: number;
  bestPlaceId: number | null;
  bestPlaceAddress: string | null;
  placesCount: number;
  totalProducts: number;
  places: RankedFarmerPlace[];
  has_eco_certificate: boolean;  // Добавляем
}

function getRankColor(rank: number): string {
  // Более плавный градиент для лучшей визуализации
  const colors = [
    '#28a745', // 1 - зеленый
    '#4caf50', // 2 - светло-зеленый
    '#8bc34a', // 3 - салатовый
    '#cddc39', // 4 - лимонный
    '#ffc107', // 5 - желтый
    '#ff9800', // 6 - оранжевый
    '#ff5722', // 7 - оранжево-красный
    '#f44336', // 8 - красный
    '#e91e63', // 9 - розовый
    '#9c27b0', // 10 - фиолетовый
    '#673ab7', // 11 - темно-фиолетовый
    '#3f51b5', // 12 - индиго
    '#2196f3', // 13 - синий
    '#03a9f4', // 14 - голубой
    '#00bcd4', // 15 - бирюзовый
    '#009688', // 16 - темно-бирюзовый
    '#4caf50', // 17 - зеленый
    '#8bc34a', // 18 - салатовый
    '#cddc39', // 19 - лимонный
    '#ffc107'  // 20+ - желтый
  ];

  if (rank <= colors.length) {
    return colors[rank - 1];
  }

  // Для больших рангов используем циклический выбор
  return colors[(rank - 1) % colors.length];
}

function mercatorToLatLng(x: number, y: number): { lat: number; lng: number } {
  const lng = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
  return { lat, lng };
}

function haversineDistance(point1: Coorinate, point2: Coorinate): number {
  const R = 6371;
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lng - point1.lng) * Math.PI / 180;
  const lat1 = point1.lat * Math.PI / 180;
  const lat2 = point2.lat * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

function computeCharacteristicDistance(distances: number[]): number {
  if (distances.length === 0) return 1;

  const logSum = distances.reduce((s, d) => s + Math.log(d + 1), 0);
  const geoMean = Math.exp(logSum / distances.length);
  const median = computeMedian(distances);
  const dChar = (geoMean + median) / 2;

  return dChar > 0 ? dChar : 1;
}

function normalizeDistance(distance: number, charDistance: number, alpha = 1.5): number {
  const safe = Math.max(charDistance, 1);
  return 1 / Math.pow(1 + distance / safe, alpha);
}

function normalizeRating(
  rating: number,
  distance: number,
  charDistance: number,
  lambda: number = 0.3
): number {
  const safeDChar = charDistance > 0 ? charDistance : 1;
  const r = Math.max(0, Math.min(5, rating)) / 5;
  const sig = 1 - Math.exp(-(lambda * distance) / safeDChar);
  return r * sig + 1 * (1 - sig);
}

function normalizeSubscription(
  subscriptionScore: number,
  distance: number,
  charDistance: number
): number {
  const safeDChar = charDistance > 0 ? charDistance : 1;
  return subscriptionScore * Math.exp(-distance / safeDChar);
}
function calculateEntropy(values: number[]): number {
  if (values.length === 0) return 0;

  const bins = Math.max(1, Math.ceil(Math.log2(values.length) + 1));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) return 0;

  const histogram = new Array(bins).fill(0);

  for (const value of values) {
    const normalized = (value - min) / range;
    const index = Math.min(bins - 1, Math.floor(normalized * bins));
    histogram[index] += 1;
  }

  const total = values.length;
  const probs = histogram.map((h) => h / total).filter((p) => p > 0);

  const entropy = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);

  // Нормализация в [0, 1]
  const maxEntropy = bins > 1 ? Math.log2(bins) : 1;

  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}
function calculateEntropyWeights(places: PlaceItem[]) {
  const distances = places.map((p) => p.distance);
  const ratings = places.map((p) => p.rating);
  const subscriptions = places.map((p) => p.subscriptionScore);

  const Hd = calculateEntropy(distances);
  const Hr = calculateEntropy(ratings);
  const Hs = calculateEntropy(subscriptions);

  const sum = Hd + Hr + Hs;

  if (sum === 0) {
    return { distance: 0.34, rating: 0.33, subscription: 0.33 };
  }

  const weights = {
    distance: Hd / sum,
    rating: Hr / sum,
    subscription: Hs / sum
  };

  console.log('[entropy] values:', {
    Hd: Number(Hd.toFixed(4)),
    Hr: Number(Hr.toFixed(4)),
    Hs: Number(Hs.toFixed(4)),
    weights: {
      distance: Number(weights.distance.toFixed(4)),
      rating: Number(weights.rating.toFixed(4)),
      subscription: Number(weights.subscription.toFixed(4))
    }
  });

  return weights;
}
function clusterByDistance1D(
  places: PlaceItem[],
  gapMultiplier: number = 2.0
): Cluster[] {
  if (places.length === 0) return [];

  const sorted = [...places].sort((a, b) => a.distance - b.distance);

  if (sorted.length === 1) {
    return [{
      id: 0,
      points: sorted,
      size: 1,
      avgDistance: sorted[0].distance,
      avgRating: sorted[0].rating,
      subscriptionRate: sorted[0].subscriptionScore,
      rank: 0,
      rankScore: 0,
      rankColor: '#cccccc'
    }];
  }

  // Вычисляем зазоры между соседними расстояниями
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].distance - sorted[i - 1].distance);
  }

  // Медиана зазоров
  const medianGap = computeMedian(gaps);

  // Порог = медиана * множитель (без минимального порога, как в продуктах)
  const threshold = medianGap * gapMultiplier;

  console.log('[clusterByDistanceForPlaces] stats:', {
    totalPlaces: sorted.length,
    medianGap: medianGap.toFixed(2),
    gapMultiplier,
    threshold: threshold.toFixed(2),
    distanceRange: {
      min: sorted[0].distance.toFixed(1),
      max: sorted[sorted.length - 1].distance.toFixed(1)
    }
  });

  // Формируем кластеры
  const rawClusters: PlaceItem[][] = [];
  let current: PlaceItem[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].distance - sorted[i - 1].distance;
    if (gap <= threshold) {
      current.push(sorted[i]);
    } else {
      rawClusters.push(current);
      current = [sorted[i]];
    }
  }

  if (current.length) {
    rawClusters.push(current);
  }

  // Преобразуем в формат Cluster
  return rawClusters.map((points, idx) => {
    const avgDistance = points.reduce((s, p) => s + p.distance, 0) / points.length;
    const avgRating = points.reduce((s, p) => s + p.rating, 0) / points.length;
    const subscriptionRate = points.reduce((s, p) => s + p.subscriptionScore, 0) / points.length;

    return {
      id: idx,
      points,
      size: points.length,
      avgDistance,
      avgRating,
      subscriptionRate,
      rank: 0,
      rankScore: 0,
      rankColor: '#cccccc'
    };
  });
}
/**
 * Адаптивная кластеризация для участков
 * Учитывает:
 * - Медиану зазоров
 * - Коэффициент вариации (разброс данных)
 * - Процент от общего диапазона расстояний
 */
function adaptiveClusterForPlaces(
  places: PlaceItem[],
  options: {
    minClusterSize?: number;
    maxClusters?: number;
    useElbowMethod?: boolean;      // добавлено
    usePercentile?: boolean;       // добавлено
  } = {}
): Cluster[] {
  const {
    minClusterSize = 2,
    maxClusters = 20,
    useElbowMethod = true,
    usePercentile = true
  } = options;

  if (places.length === 0) return [];

  const sorted = [...places].sort((a, b) => a.distance - b.distance);

  if (sorted.length === 1) {
    return [{
      id: 0,
      points: sorted,
      size: 1,
      avgDistance: sorted[0].distance,
      avgRating: sorted[0].rating,
      subscriptionRate: sorted[0].subscriptionScore,
      rank: 0,
      rankScore: 0,
      rankColor: '#cccccc'
    }];
  }

  // Вычисляем зазоры
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].distance - sorted[i - 1].distance);
  }

  // Статистический анализ зазоров
  const medianGap = computeMedian(gaps);
  const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const stdGap = Math.sqrt(gaps.reduce((s, g) => s + Math.pow(g - meanGap, 2), 0) / gaps.length);
  const cv = stdGap / meanGap;

  // Общий диапазон расстояний
  const totalRange = sorted[sorted.length - 1].distance - sorted[0].distance;
  const minDistance = sorted[0].distance;

  // === АВТОМАТИЧЕСКИЙ ПОДБОР ПАРАМЕТРОВ ===

  // 1. Подбор gapMultiplier на основе коэффициента вариации
  let gapMultiplier: number;
  if (cv < 0.3) {
    gapMultiplier = 1.2;  // очень равномерные данные → мелкие кластеры
  } else if (cv < 0.6) {
    gapMultiplier = 1.5;  // умеренный разброс
  } else if (cv < 1.0) {
    gapMultiplier = 2.0;  // значительный разброс
  } else {
    gapMultiplier = 2.5;  // очень большой разброс → крупные кластеры
  }

  // 2. Подбор минимального порога (в км) на основе перцентиля расстояний
  const percentile5 = sorted[Math.floor(sorted.length * 0.05)].distance;
  const minGapThresholdKm = Math.max(0.5, percentile5 * 0.05);

  // 3. Альтернативный порог через процент от общего диапазона
  const rangeThreshold = totalRange * 0.05;

  // 4. Метод "колена" для поиска естественных разрывов
  let elbowThreshold = Infinity;
  if (useElbowMethod && gaps.length > 2) {
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    let maxJump = 0;
    let jumpIndex = 0;
    for (let i = 1; i < sortedGaps.length; i++) {
      const jump = sortedGaps[i] - sortedGaps[i - 1];
      if (jump > maxJump) {
        maxJump = jump;
        jumpIndex = i;
      }
    }
    elbowThreshold = sortedGaps[jumpIndex - 1];
  }

  // 5. Итоговый порог
  let threshold = Math.max(minGapThresholdKm, gapMultiplier * medianGap);

  // Если диапазон большой, учитываем rangeThreshold
  if (totalRange > 100) {
    threshold = Math.min(threshold, rangeThreshold * 1.5);
  }

  // Если метод "колена" дал разумный порог, используем его
  if (useElbowMethod && elbowThreshold !== Infinity && elbowThreshold > minGapThresholdKm && elbowThreshold < threshold * 2) {
    threshold = elbowThreshold;
  }

  // Ограничиваем максимальное количество кластеров
  const targetClusterSize = Math.max(minClusterSize, Math.floor(sorted.length / maxClusters));
  let adjustedThreshold = threshold;

  // Если кластеров слишком много, увеличиваем порог
  let tempClusters = estimateClusterCount(sorted, adjustedThreshold);
  while (tempClusters > maxClusters && adjustedThreshold < totalRange * 0.3) {
    adjustedThreshold *= 1.2;
    tempClusters = estimateClusterCount(sorted, adjustedThreshold);
  }

  // Если кластеров слишком мало, уменьшаем порог
  while (tempClusters < 2 && adjustedThreshold > minGapThresholdKm) {
    adjustedThreshold *= 0.8;
    tempClusters = estimateClusterCount(sorted, adjustedThreshold);
  }

  const finalThreshold = adjustedThreshold;

  console.log('[adaptiveClusterForPlaces] stats:', {
    medianGap: medianGap.toFixed(2),
    meanGap: meanGap.toFixed(2),
    cv: cv.toFixed(3),
    totalRange: totalRange.toFixed(2),
    gapMultiplier,
    minGapThresholdKm: minGapThresholdKm.toFixed(2),
    rangeThreshold: rangeThreshold.toFixed(2),
    elbowThreshold: elbowThreshold !== Infinity ? elbowThreshold.toFixed(2) : 'none',
    finalThreshold: finalThreshold.toFixed(2),
    estimatedClusters: tempClusters
  });

  // === ФОРМИРОВАНИЕ КЛАСТЕРОВ ===
  const grouped: PlaceItem[][] = [];
  let currentCluster: PlaceItem[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].distance - sorted[i - 1].distance;
    if (gap <= finalThreshold) {
      currentCluster.push(sorted[i]);
    } else {
      if (currentCluster.length >= minClusterSize) {
        grouped.push(currentCluster);
      } else {
        // Мелкие кластеры присоединяем к предыдущему или следующему
        if (grouped.length > 0) {
          grouped[grouped.length - 1].push(...currentCluster);
        } else if (i + 1 < sorted.length) {
          currentCluster.push(sorted[i]);
          continue;
        } else {
          grouped.push(currentCluster);
        }
      }
      currentCluster = [sorted[i]];
    }
  }

  if (currentCluster.length >= minClusterSize) {
    grouped.push(currentCluster);
  } else if (currentCluster.length > 0 && grouped.length > 0) {
    grouped[grouped.length - 1].push(...currentCluster);
  } else if (currentCluster.length > 0) {
    grouped.push(currentCluster);
  }

  // Формируем результат
  return grouped.map((points, index) => {
    const avgDistance = points.reduce((sum, p) => sum + p.distance, 0) / points.length;
    const avgRating = points.reduce((sum, p) => sum + p.rating, 0) / points.length;
    const subscriptionRate = points.reduce((sum, p) => sum + p.subscriptionScore, 0) / points.length;

    return {
      id: index,
      points,
      size: points.length,
      avgDistance,
      avgRating,
      subscriptionRate,
      rank: 0,
      rankScore: 0,
      rankColor: '#cccccc'
    };
  });
}
/**
 * Вспомогательная функция для оценки количества кластеров
 */
function estimateClusterCount(sorted: any[], threshold: number): number {
  let count = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].distance - sorted[i - 1].distance > threshold) {
      count++;
    }
  }
  return count;
}
function calculatePlaceRank(
  place: PlaceItem,
  weights: { distance: number; rating: number; subscription: number },
  charDistance: number
): number {
  const Nd = normalizeDistance(place.distance, charDistance);
  const Nr = normalizeRating(place.rating, place.distance, charDistance);
  const Ns = normalizeSubscription(place.subscriptionScore, place.distance, charDistance);

  return 100 * (
    weights.distance * Nd +
    weights.rating * Nr +
    weights.subscription * Ns
  );
}

function calculateClusterRank(
  cluster: Cluster,
  weights: { distance: number; rating: number; subscription: number },
  charDistance: number
): number {
  const Nd = normalizeDistance(cluster.avgDistance, charDistance);
  const Nr = normalizeRating(cluster.avgRating, cluster.avgDistance, charDistance);
  const Ns = normalizeSubscription(cluster.subscriptionRate, cluster.avgDistance, charDistance);

  return 100 * (
    weights.distance * Nd +
    weights.rating * Nr +
    weights.subscription * Ns
  );
}
app.post('/api/buyer/clustered-farmers', authenticateToken, requireRole(3), async (req: Request, res: Response) => {
  try {
    //test
    const startedAt = Date.now();

    const userId = (req as any).user.userId;
    const { lat, lng, filters } = req.body;

    //test
    const t0 = Date.now();

    const calculateDistance = filters?.calculateDistance !== false;
    const maxDistance = Number(filters?.maxDistance ?? 500);
    const minRating = Number(filters?.minRating ?? 0);

    console.log('\n================ /api/buyer/clustered-farmers ================');
    console.log('[API] request params:', {
      userId,
      lat,
      lng,
      calculateDistance,
      maxDistance,
      minRating,
      filters
    });

    const customerRes = await pool.query(
      'SELECT id FROM customers WHERE "idUser" = $1',
      [userId]
    );

    //test
    const t1 = Date.now();

    console.log('[API] customer query result:', customerRes.rows);

    if (customerRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Профиль покупателя не найден'
      });
    }

    const customerId = customerRes.rows[0].id;

    const placesQuery = `
SELECT 
    s.id AS farmer_id,
    s.name AS farmer_name,
    sc.rating,
    s."userId",
    s."avatarUrl" AS avatar_url,
    p."imageUrl" AS place_image_url,
    sc.description,
    p.id AS place_id,
    p.address,
    p."kadastrNumber",
    p.area,
    ST_AsGeoJSON(ST_Transform(p.boundaries, 4326)) AS boundaries_geojson,
    ST_X(ST_Centroid(p.boundaries)) AS place_lng,
    ST_Y(ST_Centroid(p.boundaries)) AS place_lat,
    CASE WHEN fs.id IS NOT NULL THEN true ELSE false END AS is_subscribed,
    EXTRACT(DAY FROM (CURRENT_DATE - fs."createdAt")) AS subscription_days,
    COUNT(DISTINCT pr.id) AS product_count,
    ARRAY_AGG(DISTINCT pc.name) AS product_categories,
    ARRAY_AGG(DISTINCT no.name) FILTER (WHERE no.name IS NOT NULL) AS product_names,
    EXISTS (
        SELECT 1 
        FROM "farmerCertificates" fc
        WHERE fc."supplierId" = s.id 
          AND fc."certificateTypeId" = 1
          AND fc.status = 'active'
          AND (fc."expiryDate" IS NULL OR fc."expiryDate" > CURRENT_DATE)
    ) AS has_eco_certificate
FROM suppliers s
INNER JOIN "supplierCopies" sc ON s.id = sc."idSupplier" AND sc."isActual" = true
INNER JOIN "supplierPlaces" sp ON s.id = sp."idSupplier"
INNER JOIN places p ON sp."idPlace" = p.id
LEFT JOIN "farmerSubscriptions" fs ON fs."idCustomer" = $1 AND fs."idSupplier" = s.id
LEFT JOIN "supplierPlacesProducts" spp ON sp.id = spp."idSupplierPlace"
LEFT JOIN products pr ON spp."idProduct" = pr.id
LEFT JOIN "namesObjects" no ON pr."idObject" = no.id
LEFT JOIN "productCategories" pcats ON pr.id = pcats."idProduct"
LEFT JOIN "productCategory" pc ON pcats."idCategory" = pc.id
GROUP BY s.id, s.name, sc.rating, sc.description, p.id, p.address, p."kadastrNumber", p.area,
         p.boundaries, fs.id, fs."createdAt"
ORDER BY s.id, p.id
`;
    //filter по эко нужен ли тут?
    const placesResult = await pool.query(placesQuery, [customerId]);

    //test
    const t2 = Date.now();

    let filteredPlacesRows = placesResult.rows;

    // Фильтр по Эко-сертификатам (тип 1, активный)
    if (filters?.ecoOnly === true) {
      filteredPlacesRows = filteredPlacesRows.filter(row => row.has_eco_certificate === true);
      console.log('[API] after ecoOnly filter:', filteredPlacesRows.length);
    }

    if (filteredPlacesRows.length === 0) {
      return res.json({
        success: true,
        clusters: { clusters: [] },
        allFarmers: [],
        allPlaces: []
      });
    }
    console.log('[API] places rows count:', placesResult.rows.length);
    console.log('[API] first 10 rows preview:', placesResult.rows.slice(0, 10));

    if (placesResult.rows.length === 0) {
      return res.json({
        success: true,
        clusters: { clusters: [] },
        allFarmers: [],
        allPlaces: []
      });
    }

    const places: PlaceItem[] = [];

    for (const row of filteredPlacesRows) {
      if (!calculateDistance) continue;
      if (!lat || !lng || !row.place_lat || !row.place_lng) continue;

      const coords = mercatorToLatLng(
        parseFloat(row.place_lng),
        parseFloat(row.place_lat)
      );

      const distance = haversineDistance(
        { lat: Number(lat), lng: Number(lng) },
        { lat: coords.lat, lng: coords.lng }
      );

      places.push({
        placeId: Number(row.place_id),
        farmerId: Number(row.farmer_id),
        farmerName: row.farmer_name,
        avatar_url: row.avatar_url,
        userid: Number(row.userId ?? row.userid),
        image_place_url: row.place_image_url,
        rating: row.rating ? parseFloat(row.rating) : 0,
        subscriptionScore: row.is_subscribed ? 1 : 0,
        subscriptionDuration: row.is_subscribed ? (row.subscription_days ?? 30) : undefined,
        distance,
        address: row.address || '',
        coordinates: coords,
        is_subscribed: !!row.is_subscribed,
        productCount: Number(row.product_count),
        has_eco_certificate: row.has_eco_certificate === true,  // Добавляем
        productCategories: row.product_categories ? row.product_categories.filter(Boolean) : [],
        products: Array.isArray(row.product_names)
          ? row.product_names
            .filter(Boolean)
            .map((name: string, idx: number) => ({
              id: `product-${row.place_id}-${idx}`,
              name,
              objectName: name
            }))
          : []
      });
    }

    //test
    const t3 = Date.now();

    console.log('[API] places after distance calculation:', places.length);
    console.log(
      '[API] places preview:',
      places.slice(0, 20).map((p) => ({
        placeId: p.placeId,
        farmerId: p.farmerId,
        farmerName: p.farmerName,
        distance: p.distance,
        rating: p.rating,
        subscription: p.subscriptionScore,
        address: p.address
      }))
    );

    let filteredPlaces = places.filter((p) => p.rating >= minRating);

    console.log('[API] after minRating filter:', filteredPlaces.length);

    if (calculateDistance) {
      filteredPlaces = filteredPlaces.filter((p) => p.distance <= maxDistance);
    }

    console.log('[API] after maxDistance filter:', filteredPlaces.length);
    console.log(
      '[API] filteredPlaces sorted by distance:',
      [...filteredPlaces]
        .sort((a, b) => a.distance - b.distance)
        .map((p) => ({
          placeId: p.placeId,
          farmerName: p.farmerName,
          distance: Number(p.distance.toFixed(2)),
          rating: p.rating
        }))
    );

    if (filteredPlaces.length === 0) {
      return res.json({
        success: true,
        clusters: { clusters: [] },
        allFarmers: [],
        allPlaces: []
      });
    }

    const characteristicDistance = computeCharacteristicDistance(
      filteredPlaces.map((p) => p.distance)
    );

    console.log('[API] characteristicDistance:', characteristicDistance);

    const entropyWeights = calculateEntropyWeights(filteredPlaces);
    console.log('[API] entropyWeights:', entropyWeights);

    const rawClusters = useAdaptiveClustering
      ? adaptiveClusterForPlaces(filteredPlaces, { minClusterSize: 2, maxClusters: 20 })
      : clusterByDistance1D(filteredPlaces, 2.0);

    const rankedClusters = rawClusters
      .map((cluster) => ({
        ...cluster,
        rankScore: calculateClusterRank(cluster, entropyWeights, characteristicDistance)
      }))
      .sort((a, b) => b.rankScore - a.rankScore);

    rankedClusters.forEach((cluster, index) => {
      cluster.rank = index + 1;
      cluster.rankColor = getRankColor(index + 1);
      cluster.points.sort((a, b) => a.distance - b.distance);
    });

    console.log(
      '[API] rankedClusters:',
      rankedClusters.map((c) => ({
        id: c.id,
        rank: c.rank,
        rankScore: Number(c.rankScore.toFixed(2)),
        size: c.size,
        avgDistance: Number(c.avgDistance.toFixed(2)),
        minDistance: Number(c.points[0]?.distance?.toFixed(2) || 0),
        maxDistance: Number(c.points[c.points.length - 1]?.distance?.toFixed(2) || 0)
      }))
    );

    const rankedPlaces: RankedPlace[] = filteredPlaces
      .map((place) => {
        const cluster = rankedClusters.find((c) =>
          c.points.some((p) => p.placeId === place.placeId)
        );

        return {
          ...place,
          clusterId: cluster?.id ?? -1,
          clusterRank: cluster?.rank ?? 999,
          clusterRankColor: cluster?.rankColor ?? '#cccccc',
          individualScore: calculatePlaceRank(place, entropyWeights, characteristicDistance)
        };
      })
      .sort((a, b) => {
        if (a.clusterRank !== b.clusterRank) return a.clusterRank - b.clusterRank;
        return b.individualScore - a.individualScore;
      });
    console.log(
      '[API] rankedPlaces final order:',
      rankedPlaces.map((p) => ({
        placeId: p.placeId,
        farmerName: p.farmerName,
        clusterRank: p.clusterRank,
        distance: Number(p.distance.toFixed(2)),
        score: Number(p.individualScore.toFixed(2))
      }))
    );

    //test
    const t4 = Date.now();

    const farmerMap = new Map<number, RankedFarmer>();

    for (const place of rankedPlaces) {
      const existing = farmerMap.get(place.farmerId);

      if (!existing) {
        farmerMap.set(place.farmerId, {
          id: place.farmerId,
          name: place.farmerName,
          rating: place.rating,
          distance: place.distance,
          is_subscribed: place.is_subscribed,
          clusterId: place.clusterId,
          clusterRank: place.clusterRank,
          userid: place.userid,   // добавляем
          clusterRankColor: place.clusterRankColor,
          individualScore: place.individualScore,
          bestPlaceId: place.placeId,
          bestPlaceAddress: place.address,
          placesCount: 1,
          has_eco_certificate: place.has_eco_certificate,  // Добавляем
          totalProducts: 0,
          places: [
            {
              id: place.placeId,
              address: place.address,
              image_url: place.image_place_url,
              distance: place.distance,
              products: place.products ?? [],
              productCount: place.productCount,
              productCategories: place.productCategories,
              individualScore: place.individualScore,
              clusterId: place.clusterId,
              clusterRank: place.clusterRank
            }
          ]
        });
      } else {
        existing.placesCount += 1;
        existing.places.push({
          id: place.placeId,
          address: place.address,
          image_url: place.image_place_url,
          distance: place.distance,
          products: place.products ?? [],
          productCount: place.productCount,
          productCategories: place.productCategories,
          individualScore: place.individualScore,
          clusterId: place.clusterId,
          clusterRank: place.clusterRank
        });

        if (place.individualScore > existing.individualScore) {
          existing.rating = place.rating;
          existing.distance = place.distance;
          existing.is_subscribed = place.is_subscribed;
          existing.clusterId = place.clusterId;
          existing.clusterRank = place.clusterRank;
          existing.clusterRankColor = place.clusterRankColor;
          existing.individualScore = place.individualScore;
          existing.bestPlaceId = place.placeId;
          existing.bestPlaceAddress = place.address;
        }
      }
    }

    const allFarmers = Array.from(farmerMap.values())
      .map((farmer) => ({
        ...farmer,
        places: [...farmer.places].sort((a, b) => b.individualScore - a.individualScore)
      }))
      .sort((a, b) => {
        if (a.clusterRank !== b.clusterRank) return a.clusterRank - b.clusterRank;
        return b.individualScore - a.individualScore;
      });
    //ЛОГ ПО АГЛОРИТМАМ!!!!!!!!!!
    // console.log(
    //   '[API] allFarmers final order:',
    //   allFarmers.map((f) => ({
    //     id: f.id,
    //     name: f.name,
    //     clusterRank: f.clusterRank,
    //     bestDistance: f.distance,
    //     bestScore: Number(f.individualScore.toFixed(2)),
    //     placesCount: f.placesCount,
    //     places: f.places.map((p) => ({
    //       placeId: p.id,
    //       distance: Number(p.distance.toFixed(2)),
    //       score: Number(p.individualScore.toFixed(2))
    //     }))
    //   }))
    // );

    const clusterData = {
      clusters: rankedClusters.map((cluster) => ({
        id: cluster.id,
        rank: cluster.rank,
        rankScore: cluster.rankScore,
        rankColor: cluster.rankColor,
        size: cluster.size,
        avgDistance: cluster.avgDistance,
        avgRating: cluster.avgRating,
        subscriptionRate: cluster.subscriptionRate,
        farmers: cluster.points
          .map((p) => {
            const rankedPlace = rankedPlaces.find((rp) => rp.placeId === p.placeId);

            return {
              id: p.farmerId,
              name: p.farmerName,
              rating: p.rating,
              distance: p.distance,
              individualScore: rankedPlace?.individualScore ?? 0,
              is_subscribed: p.is_subscribed,
              x: normalizeDistance(p.distance, characteristicDistance) * 100,
              y: (Math.max(0, Math.min(5, p.rating)) / 5) * 100,
              bestPlaceAddress: p.address,
              placeId: p.placeId
            };
          })
          .sort((a, b) => b.individualScore - a.individualScore)
      })),
      characteristicDistance,
      entropyWeights
    };


    //test
    const t5 = Date.now();
    console.log('[clustered-farmers][timing]', {
      customerMs: t1 - t0,
      sqlMs: t2 - t1,
      transformMs: t3 - t2,
      clusteringMs: t4 - t3,
      responseMs: t5 - t4,
      totalMs: t5 - startedAt,
      placesRows: placesResult.rows.length,
      filteredRows: filteredPlacesRows.length
    });

    console.log('[API] response ready');
    console.log('============================================================\n');

    return res.json({
      success: true,
      clusters: clusterData,
      allFarmers,
      allPlaces: rankedPlaces
    });
  } catch (error) {
    console.error('Cluster API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});
// ========== PRODUCT CLUSTERING AND RANKING ==========
// ========== ТИПЫ ==========
// ===============================
// TYPES FOR PRODUCTS
// ===============================
// ===============================
// ТИПЫ ДЛЯ ПРОДУКТОВ
// ===============================
// ===============================
// ТИПЫ ДЛЯ ПРОДУКТОВ
// ===============================

interface ProductItem {
  productId: number;
  productName: string;
  objectId: number;
  objectName: string;
  imagePath?: string | null;
  varietyId?: number;
  varietyName?: string;
  fullProductName: string;
  farmerId: number;
  farmerName: string;
  farmerRating: number;
  productRating: number;
  distance: number;
  locationType: number;
  has_eco_certificate?: boolean;
  price: number;
  quantity: number;
  unit: string;
  isWholesale: boolean;
  ripenessCategory: number;
  auctionId?: number;
  auctionStartPrice?: number;
  auctionCurrentBid?: number;
  auctionEndTime?: Date;
  placeId: number;
  placeAddress: string;
  coordinates?: { lat: number; lng: number };
  subscriptionScore: number;
  normDistance?: number;
  normFarmerRating?: number;
  normProductRating?: number;
  computedRating?: number;
  clusterId?: number;
  clusterRank?: number;
  clusterRankColor?: string;
}

interface ProductCluster {
  id: number;
  points: ProductItem[];
  size: number;
  avgDistance: number;
  avgFarmerRating: number;
  avgProductRating: number;
  auctionRate: number;
  rank: number;
  rankScore: number;
  rankColor: string;
}

// ===============================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ===============================

function computeMedianProduct(values: number[]): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function computeCharacteristicDistanceProduct(distances: number[]): number {
  if (distances.length === 0) return 1;
  const logSum = distances.reduce((s, d) => s + Math.log(d + 1), 0);
  const geoMean = Math.exp(logSum / distances.length);
  const median = computeMedianProduct(distances);
  return (geoMean + median) / 2;
}

function normalizeDistanceProduct(distance: number, charDistance: number, alpha = 1.5): number {
  const safe = Math.max(charDistance, 1);
  return 1 / Math.pow(1 + distance / safe, alpha);
}

function normalizeRatingProduct(rating: number, distance: number, charDistance: number, lambda: number = 0.3): number {
  const safeDChar = charDistance > 0 ? charDistance : 1;
  const r = Math.max(0, Math.min(5, rating)) / 5;
  const sig = 1 - Math.exp(-(lambda * distance) / safeDChar);
  return r * sig + 1 * (1 - sig);
}

function calculateEntropyProduct(values: number[]): number {
  if (values.length === 0) return 0;
  const bins = Math.max(1, Math.ceil(Math.log2(values.length) + 1));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return 0;
  const histogram = new Array(bins).fill(0);
  for (const value of values) {
    const normalized = (value - min) / range;
    const index = Math.min(bins - 1, Math.floor(normalized * bins));
    histogram[index]++;
  }
  const total = values.length;
  const probs = histogram.map(h => h / total).filter(p => p > 0);
  const entropy = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
  const maxEntropy = bins > 1 ? Math.log2(bins) : 1;
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

function calculateProductEntropyWeights(products: ProductItem[]) {
  const distances = products.map(p => p.distance);
  const farmerRatings = products.map(p => p.farmerRating);
  const productRatings = products.map(p => p.productRating);

  const H_dist = calculateEntropyProduct(distances);
  const H_farmer = calculateEntropyProduct(farmerRatings);
  const H_product = calculateEntropyProduct(productRatings);

  const sumH = H_dist + H_farmer + H_product;

  if (sumH === 0) {
    return { distance: 0.34, farmerRating: 0.33, productRating: 0.33 };
  }

  const weights = {
    distance: H_dist / sumH,
    farmerRating: H_farmer / sumH,
    productRating: H_product / sumH
  };

  console.log('[product entropy] values:', {
    H_dist: H_dist.toFixed(4),
    H_farmer: H_farmer.toFixed(4),
    H_product: H_product.toFixed(4),
    weights
  });

  return weights;
}
/**
 * Адаптивная кластеризация для продуктов
 * Учитывает:
 * - Распределение расстояний
 * - Наличие аукционных товаров (может влиять на кластеризацию)
 * - Плотность данных в разных диапазонах
 */
function adaptiveClusterForProducts(
  products: ProductItem[],
  options: {
    minClusterSize?: number;
    maxClusters?: number;
    auctionWeight?: number;
    useElbowMethod?: boolean;      // добавлено
  } = {}
): ProductCluster[] {
  const {
    minClusterSize = 2,
    maxClusters = 30,
    auctionWeight = 1.0,
    useElbowMethod = true
  } = options;

  if (products.length === 0) return [];

  const sorted = [...products].sort((a, b) => a.distance - b.distance);

  if (sorted.length === 1) {
    return [{
      id: 0,
      points: sorted,
      size: 1,
      avgDistance: sorted[0].distance,
      avgFarmerRating: sorted[0].farmerRating,
      avgProductRating: sorted[0].productRating,
      auctionRate: sorted[0].locationType === 2 ? 1 : 0,
      rank: 0,
      rankScore: 0,
      rankColor: '#cccccc'
    }];
  }

  // Вычисляем зазоры
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].distance - sorted[i - 1].distance);
  }

  // Статистический анализ
  const medianGap = computeMedianProduct(gaps);
  const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const stdGap = Math.sqrt(gaps.reduce((s, g) => s + Math.pow(g - meanGap, 2), 0) / gaps.length);
  const cv = stdGap / meanGap;

  // Общий диапазон расстояний
  const totalRange = sorted[sorted.length - 1].distance - sorted[0].distance;
  const minDistance = sorted[0].distance;
  const maxDistance = sorted[sorted.length - 1].distance;

  // === АВТОМАТИЧЕСКИЙ ПОДБОР ПАРАМЕТРОВ ДЛЯ ПРОДУКТОВ ===

  // 1. Базовый множитель на основе коэффициента вариации
  let baseMultiplier: number;
  if (cv < 0.3) {
    baseMultiplier = 1.2;
  } else if (cv < 0.6) {
    baseMultiplier = 1.5;
  } else if (cv < 1.0) {
    baseMultiplier = 2.0;
  } else {
    baseMultiplier = 3.0;
  }

  // 2. Корректировка на основе диапазона расстояний
  let rangeFactor = 1.0;
  if (totalRange > 5000) {
    rangeFactor = 1.5;
  } else if (totalRange < 100) {
    rangeFactor = 0.8;
  }

  // 3. Корректировка на основе наличия аукционов
  const auctionRate = products.filter(p => p.locationType === 2).length / products.length;
  let auctionFactor = 1.0;
  if (auctionRate > 0.3) {
    auctionFactor = 0.9;
  } else if (auctionRate > 0.1) {
    auctionFactor = 0.95;
  }

  // 4. Итоговый множитель
  let gapMultiplier = baseMultiplier * rangeFactor * auctionFactor;
  gapMultiplier = Math.max(1.0, Math.min(5.0, gapMultiplier));

  // 5. Порог через процент от общего диапазона
  let rangeThreshold = totalRange * 0.05;
  if (maxDistance > 5000) {
    rangeThreshold = totalRange * 0.1;
  } else if (maxDistance > 1000) {
    rangeThreshold = totalRange * 0.07;
  }

  // 6. Порог на основе медианы зазоров
  const medianThreshold = medianGap * gapMultiplier;

  // 7. Метод "колена" для поиска естественных разрывов
  let elbowThreshold = Infinity;
  if (useElbowMethod && gaps.length > 3) {
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    let maxJump = 0;
    let jumpIndex = 0;
    for (let i = 1; i < sortedGaps.length; i++) {
      const jump = sortedGaps[i] - sortedGaps[i - 1];
      if (jump > maxJump) {
        maxJump = jump;
        jumpIndex = i;
      }
    }
    elbowThreshold = sortedGaps[jumpIndex - 1];
  }

  // 8. Выбор итогового порога
  let threshold = Math.min(medianThreshold, rangeThreshold);

  if (useElbowMethod && elbowThreshold !== Infinity && elbowThreshold > 0.5 && elbowThreshold < threshold * 2) {
    threshold = Math.min(threshold, elbowThreshold);
  }

  // 9. Ограничиваем порог
  const estimatedClusters = estimateClusterCount(sorted, threshold);
  if (estimatedClusters > maxClusters) {
    const adjustment = Math.pow(estimatedClusters / maxClusters, 0.5);
    threshold = Math.min(threshold * adjustment, totalRange * 0.2);
  } else if (estimatedClusters < 3 && threshold > minDistance * 0.1) {
    threshold = Math.max(threshold * 0.7, 0.5);
  }

  threshold = Math.max(0.5, threshold);

  console.log('[adaptiveClusterForProducts] stats:', {
    medianGap: medianGap.toFixed(2),
    cv: cv.toFixed(3),
    totalRange: totalRange.toFixed(2),
    auctionRate: (auctionRate * 100).toFixed(1) + '%',
    baseMultiplier,
    rangeFactor,
    auctionFactor,
    gapMultiplier: gapMultiplier.toFixed(2),
    medianThreshold: medianThreshold.toFixed(2),
    rangeThreshold: rangeThreshold.toFixed(2),
    elbowThreshold: elbowThreshold !== Infinity ? elbowThreshold.toFixed(2) : 'none',
    finalThreshold: threshold.toFixed(2),
    estimatedClusters
  });

  // === ФОРМИРОВАНИЕ КЛАСТЕРОВ ===
  const rawClusters: ProductItem[][] = [];
  let current: ProductItem[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].distance - sorted[i - 1].distance;
    if (gap <= threshold) {
      current.push(sorted[i]);
    } else {
      if (current.length >= minClusterSize) {
        rawClusters.push(current);
      } else {
        if (rawClusters.length > 0) {
          rawClusters[rawClusters.length - 1].push(...current);
        } else if (i + 1 < sorted.length) {
          current.push(sorted[i]);
          continue;
        } else {
          rawClusters.push(current);
        }
      }
      current = [sorted[i]];
    }
  }

  if (current.length >= minClusterSize) {
    rawClusters.push(current);
  } else if (current.length > 0 && rawClusters.length > 0) {
    rawClusters[rawClusters.length - 1].push(...current);
  } else if (current.length > 0) {
    rawClusters.push(current);
  }

  return rawClusters.map((points, idx) => {
    const avgDistance = points.reduce((s, p) => s + p.distance, 0) / points.length;
    const avgFarmer = points.reduce((s, p) => s + p.farmerRating, 0) / points.length;
    const avgProduct = points.reduce((s, p) => s + p.productRating, 0) / points.length;
    const auctionRate = points.filter(p => p.locationType === 2).length / points.length;

    return {
      id: idx,
      points,
      size: points.length,
      avgDistance,
      avgFarmerRating: avgFarmer,
      avgProductRating: avgProduct,
      auctionRate,
      rank: 0,
      rankScore: 0,
      rankColor: '#cccccc'
    };
  });
}
function clusterByDistanceAdaptive(products: ProductItem[], gapMultiplier: number = 5.0): ProductCluster[] {
  if (products.length === 0) return [];
  const sorted = [...products].sort((a, b) => a.distance - b.distance);
  if (sorted.length === 1) {
    return [{
      id: 0,
      points: sorted,
      size: 1,
      avgDistance: sorted[0].distance,
      avgFarmerRating: sorted[0].farmerRating,
      avgProductRating: sorted[0].productRating,
      auctionRate: sorted[0].locationType === 2 ? 1 : 0,
      rank: 0,
      rankScore: 0,
      rankColor: '#cccccc'
    }];
  }
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].distance - sorted[i - 1].distance);
  }
  const medianGap = computeMedianProduct(gaps);
  const threshold = medianGap * gapMultiplier;
  const rawClusters: ProductItem[][] = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].distance - sorted[i - 1].distance;
    if (gap <= threshold) {
      current.push(sorted[i]);
    } else {
      rawClusters.push(current);
      current = [sorted[i]];
    }
  }
  if (current.length) rawClusters.push(current);
  return rawClusters.map((points, idx) => {
    const avgDistance = points.reduce((s, p) => s + p.distance, 0) / points.length;
    const avgFarmer = points.reduce((s, p) => s + p.farmerRating, 0) / points.length;
    const avgProduct = points.reduce((s, p) => s + p.productRating, 0) / points.length;
    const auctionRate = points.filter(p => p.locationType === 2).length / points.length;
    return {
      id: idx,
      points,
      size: points.length,
      avgDistance,
      avgFarmerRating: avgFarmer,
      avgProductRating: avgProduct,
      auctionRate,
      rank: 0,
      rankScore: 0,
      rankColor: '#cccccc'
    };
  });
}

function computeProductRating(
  product: ProductItem,
  weights: { distance: number; farmerRating: number; productRating: number },
  charDistance: number
): number {
  const Nd = normalizeDistanceProduct(product.distance, charDistance);
  const Nf = normalizeRatingProduct(product.farmerRating, product.distance, charDistance);
  const Np = normalizeRatingProduct(product.productRating, product.distance, charDistance);
  let rating = 100 * (weights.distance * Nd + weights.farmerRating * Nf + weights.productRating * Np);
  if (product.locationType === 2) {
    rating *= 1.3;
  }
  return Math.min(100, rating);
}

function computeClusterRank(cluster: ProductCluster, weights: any, charDistance: number): number {
  const Nd = normalizeDistanceProduct(cluster.avgDistance, charDistance);
  const Nf = normalizeRatingProduct(cluster.avgFarmerRating, cluster.avgDistance, charDistance);
  const Np = normalizeRatingProduct(cluster.avgProductRating, cluster.avgDistance, charDistance);
  let score = 100 * (weights.distance * Nd + weights.farmerRating * Nf + weights.productRating * Np);
  if (cluster.auctionRate > 0) {
    score *= (1 + cluster.auctionRate * 0.3);
  }
  return Math.min(100, score);
}

// ===============================
// ОСНОВНОЙ ЭНДПОИНТ
// ===============================

app.post('/api/buyer/clustered-products', authenticateToken, requireRole(3), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { lat, lng, filters } = req.body;

    const calculateDistance = filters?.calculateDistance !== false;
    const maxDistance = Number(filters?.maxDistance ?? 500);
    const minRating = Number(filters?.minRating ?? 0);
    const saleType = filters?.saleType || 'all';
    const locationType = filters?.locationType || 'all';
    const minQuantity = Number(filters?.minQuantity ?? 0);
    const selectedRipeness = filters?.ripenessCategories || [3];
    const testMode = filters?.testMode === true;

    console.log('\n================ /api/buyer/clustered-products ================');
    console.log('[API] request params:', { userId, lat, lng, filters, testMode });

    const customerRes = await pool.query('SELECT id FROM customers WHERE "idUser" = $1', [userId]);
    if (customerRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Профиль покупателя не найден' });
    }
    const customerId = customerRes.rows[0].id;

    const subsRes = await pool.query('SELECT "idSupplier" as idsupplier FROM "farmerSubscriptions" WHERE "idCustomer" = $1', [customerId]);
    const subscribedFarmers = new Set(subsRes.rows.map(r => r.idsupplier));

    const productsQuery = `
  SELECT 
    pc.id AS product_copy_id,
    pc.rating AS product_rating,
    pc."wholePart" AS wholepart,
    pc.copecks,
    pc.weight,
    pc."idLocationProduct",
    pr.id AS product_id,
    pr.name AS product_name,
    no.id AS object_id,
    no.name AS object_name,
    v.id AS variety_id,
    v.name AS variety_name,
    s.id AS farmer_id,
    pr."imagePath" AS product_image_path,
    s.name AS farmer_name,
    sc.rating AS farmer_rating,
    p.id AS place_id,
    p.address AS place_address,
    ST_X(ST_Centroid(p.boundaries)) AS place_lng,
    ST_Y(ST_Centroid(p.boundaries)) AS place_lat,
    d.name AS unit_name,
    lp.name AS location_type_name,
    CASE 
        WHEN f.name ILIKE '%ripe%' THEN 3
        WHEN f.name ILIKE '%almostripe%' THEN 2
        WHEN f.name ILIKE '%unripe%' THEN 1
        WHEN f.name ILIKE '%spoiled%' THEN 0
        ELSE 2
    END AS ripeness_category,
    a.id AS auction_id,
    a."startPrice" AS auction_startprice,
    a."minStep" AS auction_minstep,
    a."buyNowPrice" AS auction_buynowprice,
    a."endTime" AS auction_endtime,
    (
        SELECT b."bidAmountWhole" 
        FROM "auctionBids" b 
        WHERE b."idAuction" = a.id 
        ORDER BY b."bidAmountWhole" DESC 
        LIMIT 1
    ) AS auction_current_bid,
    EXISTS (
        SELECT 1 
        FROM "farmerCertificates" fc
        WHERE fc."supplierId" = s.id 
          AND fc."certificateTypeId" = 1
          AND fc.status = 'active'
          AND (fc."expiryDate" IS NULL OR fc."expiryDate" > CURRENT_DATE)
    ) AS has_eco_certificate
FROM "productCopies" pc
INNER JOIN products pr ON pc."idProduct" = pr.id
INNER JOIN "namesObjects" no ON pr."idObject" = no.id
LEFT JOIN varieties v ON no."idVariety" = v.id
INNER JOIN "supplierPlacesProducts" spp ON pr.id = spp."idProduct"
INNER JOIN "supplierPlaces" sp ON spp."idSupplierPlace" = sp.id
INNER JOIN suppliers s ON sp."idSupplier" = s.id
INNER JOIN "supplierCopies" sc ON s.id = sc."idSupplier" AND sc."isActual" = true
INNER JOIN places p ON sp."idPlace" = p.id
LEFT JOIN freshness f ON pc."idFreshness" = f.id
LEFT JOIN "productDimensions" d ON pc."idDimension" = d.id
LEFT JOIN "locationProduct" lp ON pc."idLocationProduct" = lp.id
LEFT JOIN auctions a ON a."idProduct" = pr.id 
    AND a."idSupplier" = s.id 
    AND a."startTime" <= NOW() 
    AND a."endTime" >= NOW()
    AND NOT EXISTS (
        SELECT 1 
        FROM "auctionHistory" ah 
        WHERE ah."idAuction" = a.id 
          AND ah.status = 'cancelled' 
          AND ah."isActive" = true
    )
WHERE pc."isActual" = true
  AND p.boundaries IS NOT NULL
  AND (sc.rating >= $1 OR sc.rating IS NULL)
  AND (
        ($2::text = 'all') 
        OR ($2::text = 'wholesale' AND pc.weight >= 10) 
        OR ($2::text = 'retail' AND pc.weight < 10)
  )
  AND (
        ($3::text = 'all') 
        OR ($3::text = 'market' AND pc."idLocationProduct" = 1) 
        OR ($3::text = 'auction' AND pc."idLocationProduct" = 2) 
        OR ($3::text = 'warehouse' AND pc."idLocationProduct" = 3)
  )
  AND (pc.weight >= $4 OR $4 = 0)
ORDER BY s.id, p.id, pr.id
    `;

    const productsResult = await pool.query(productsQuery, [minRating, saleType, locationType, minQuantity]);
    console.log('[API] products rows count:', productsResult.rows.length);
    let filteredProductsRows = productsResult.rows;

    // Фильтр по Эко-сертификатам (если включен)
    if (filters?.ecoOnly === true) {
      filteredProductsRows = filteredProductsRows.filter(row => row.has_eco_certificate === true);
      console.log('[API] after ecoOnly filter (products):', filteredProductsRows.length);
    }

    if (filteredProductsRows.length === 0) {
      return res.json({
        success: true,
        clusters: { clusters: [] },
        allProducts: [],
        stats: { totalProducts: 0, totalGroups: 0, totalClusters: 0 }
      });
    }
    if (productsResult.rows.length === 0) {
      return res.json({
        success: true,
        clusters: { clusters: [] },
        allProducts: [],
        stats: { totalProducts: 0, totalGroups: 0, totalClusters: 0 }
      });
    }

    // const products: ProductItem[] = [];
    // for (const row of filteredProductsRows) {
    //   let distance: number | null = null;
    //   if (calculateDistance && lat && lng && row.place_lng && row.place_lat) {
    //     const coords = mercatorToLatLng(parseFloat(row.place_lng), parseFloat(row.place_lat));
    //     distance = haversineDistance({ lat: Number(lat), lng: Number(lng) }, { lat: coords.lat, lng: coords.lng });
    //   }
    //   if (!calculateDistance || distance === null) continue;
    //   if (distance > maxDistance) continue;
    //   if (!selectedRipeness.includes(row.ripeness_category)) continue;

    //   const totalPrice = (row.wholepart || 0) + (row.copecks || 0) / 100;
    //   const fullName = row.variety_name ? `${row.object_name} ${row.variety_name}` : row.object_name;

    //   products.push({
    //     productId: row.product_id,
    //     productName: row.product_name,
    //     objectId: row.object_id,
    //     objectName: row.object_name,
    //     varietyId: row.variety_id,
    //     varietyName: row.variety_name,
    //     fullProductName: fullName,
    //     farmerId: row.farmer_id,
    //     has_eco_certificate: row.has_eco_certificate === true,
    //     farmerName: row.farmer_name,
    //     farmerRating: row.farmer_rating ? parseFloat(row.farmer_rating) : 0,
    //     productRating: row.product_rating ? parseFloat(row.product_rating) : 0,
    //     distance,
    //     locationType: row.idlocationproduct || 1,
    //     price: totalPrice,
    //     quantity: row.weight || 1,
    //     unit: row.unit_name || 'шт',
    //     isWholesale: (row.weight || 0) >= 10,
    //     ripenessCategory: row.ripeness_category,
    //     auctionId: row.auction_id,
    //     auctionStartPrice: row.auction_startprice,
    //     auctionCurrentBid: row.auction_current_bid,
    //     auctionEndTime: row.auction_endtime,
    //     placeId: row.place_id,
    //     placeAddress: row.place_address,
    //     coordinates: { lat: parseFloat(row.place_lat), lng: parseFloat(row.place_lng) },
    //     subscriptionScore: subscribedFarmers.has(row.farmer_id) ? 1 : 0
    //   });
    // }
    const products: ProductItem[] = [];
    for (const row of filteredProductsRows) {
      let distance: number | null = null;
      let coords: { lat: number; lng: number } | null = null;

      if (row.place_lng && row.place_lat) {
        coords = mercatorToLatLng(
          parseFloat(row.place_lng),
          parseFloat(row.place_lat)
        );
      }

      if (calculateDistance && lat && lng && coords) {
        distance = haversineDistance(
          { lat: Number(lat), lng: Number(lng) },
          { lat: coords.lat, lng: coords.lng }
        );
      }

      if (calculateDistance && distance === null) continue;
      if (calculateDistance && distance !== null && distance > maxDistance) continue;
      if (!selectedRipeness.includes(row.ripeness_category)) continue;

      const totalPrice = (row.wholepart || 0) + (row.copecks || 0) / 100;
      const fullName = row.variety_name ? `${row.object_name} ${row.variety_name}` : row.object_name;

      products.push({
        productId: row.product_id,
        productName: row.product_name,
        objectId: row.object_id,
        imagePath: row.product_image_path || null,
        objectName: row.object_name,
        varietyId: row.variety_id,
        varietyName: row.variety_name,
        fullProductName: fullName,
        farmerId: row.farmer_id,
        has_eco_certificate: row.has_eco_certificate === true,
        farmerName: row.farmer_name,
        farmerRating: row.farmer_rating ? parseFloat(row.farmer_rating) : 0,
        productRating: row.product_rating ? parseFloat(row.product_rating) : 0,
        distance: distance ?? 0,
        locationType: row.idlocationproduct || 1,
        price: totalPrice,
        quantity: row.weight || 1,
        unit: row.unit_name || 'шт',
        isWholesale: (row.weight || 0) >= 10,
        ripenessCategory: row.ripeness_category,
        auctionId: row.auction_id,
        auctionStartPrice: row.auction_startprice,
        auctionCurrentBid: row.auction_current_bid,
        auctionEndTime: row.auction_endtime,
        placeId: row.place_id,
        placeAddress: row.place_address,
        coordinates: coords || undefined,
        subscriptionScore: subscribedFarmers.has(row.farmer_id) ? 1 : 0
      });
    }
    console.log('[API] products after filters:', products.length);
    if (products.length === 0) {
      return res.json({
        success: true,
        clusters: { clusters: [] },
        allProducts: [],
        stats: { totalProducts: 0, totalGroups: 0, totalClusters: 0 }
      });
    }

    const distances = products.map(p => p.distance);
    const farmerRatings = products.map(p => p.farmerRating);
    const productRatings = products.map(p => p.productRating);
    const minDist = Math.min(...distances);
    const maxDist = Math.max(...distances);
    const minFarmer = Math.min(...farmerRatings);
    const maxFarmer = Math.max(...farmerRatings);
    const minProduct = Math.min(...productRatings);
    const maxProduct = Math.max(...productRatings);

    const normalized = products.map(p => ({
      ...p,
      normDistance: maxDist - minDist === 0 ? 0.5 : 1 - (p.distance - minDist) / (maxDist - minDist),
      normFarmerRating: maxFarmer - minFarmer === 0 ? 0.5 : (p.farmerRating - minFarmer) / (maxFarmer - minFarmer),
      normProductRating: maxProduct - minProduct === 0 ? 0.5 : (p.productRating - minProduct) / (maxProduct - minProduct)
    }));

    const charDistance = computeCharacteristicDistanceProduct(distances);
    const weights = calculateProductEntropyWeights(normalized);
    console.log('[API] product entropy weights:', weights);

    const rawClusters = useAdaptiveClustering
      ? adaptiveClusterForProducts(normalized, { minClusterSize: 2, maxClusters: 30, auctionWeight: 1.0 })
      : clusterByDistanceAdaptive(normalized, 5.0);

    const rankedClusters = rawClusters.map(cluster => ({
      ...cluster,
      rankScore: computeClusterRank(cluster, weights, charDistance)
    })).sort((a, b) => b.rankScore - a.rankScore);

    rankedClusters.forEach((c, idx) => {
      c.rank = idx + 1;
      c.rankColor = getRankColor(idx + 1);
    });

    normalized.forEach(p => {
      p.computedRating = computeProductRating(p, weights, charDistance);
    });

    // Возвращаем плоский список продуктов (без группировки)
    const allProducts = normalized.map(p => {
      const cluster = rankedClusters.find(c => c.points.some(cp => cp.productId === p.productId && cp.farmerId === p.farmerId));
      return {
        ...p,
        clusterId: cluster?.id ?? -1,
        clusterRank: cluster?.rank ?? 999,
        clusterRankColor: cluster?.rankColor ?? '#cccccc',
        clusterRankScore: cluster?.rankScore ?? 0
      };
    }).sort((a, b) => {
      if (a.clusterRank !== b.clusterRank) return a.clusterRank - b.clusterRank;
      return (b.computedRating || 0) - (a.computedRating || 0);
    });

    const clusterData = {
      clusters: rankedClusters.map(c => ({
        id: c.id,
        rank: c.rank,
        rankScore: c.rankScore,
        rankColor: c.rankColor,
        size: c.size,
        avgDistance: c.avgDistance,
        avgFarmerRating: c.avgFarmerRating,
        avgProductRating: c.avgProductRating,
        auctionRate: c.auctionRate,
        products: c.points.map(p => ({
          id: p.productId,
          name: p.fullProductName,
          farmerName: p.farmerName,
          distance: p.distance,
          farmerRating: p.farmerRating,
          productRating: p.productRating,
          subscriptionScore: p.subscriptionScore,
          price: { whole: Math.floor(p.price), copecks: Math.round((p.price % 1) * 100) },
          locationType: p.locationType,
          locationTypeName: p.locationType === 1 ? 'Рынок' : p.locationType === 2 ? 'Аукцион' : 'Склад',
          isWholesale: p.isWholesale,
          x: (p.normDistance ?? 0.5) * 100,
          y: ((p.normFarmerRating ?? 0.5) + (p.normProductRating ?? 0.5)) / 2 * 100,
          computedRating: p.computedRating
        }))
      }))
    };

    const stats = {
      totalProducts: normalized.length,
      totalGroups: allProducts.length,
      totalClusters: rankedClusters.length,
      minPrice: Math.min(...normalized.map(p => p.price)),
      maxPrice: Math.max(...normalized.map(p => p.price)),
      avgPrice: normalized.reduce((s, p) => s + p.price, 0) / normalized.length
    };

    console.log('[API] response ready');
    res.json({
      success: true,
      clusters: clusterData,
      allProducts,  // плоский список
      stats,
      needsFilters: false
    });

  } catch (error) {
    console.error('Error in clustered products:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// const UPLOADS_DIR = path.join(__dirname, '../uploads');
// const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
// const PLACES_DIR = path.join(UPLOADS_DIR, 'places');
// const PRODUCTS_IMAGES_DIR = path.join(UPLOADS_DIR, 'productsImages');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
const PLACES_DIR = path.join(UPLOADS_DIR, 'places');
const PRODUCTS_IMAGES_DIR = path.join(UPLOADS_DIR, 'productsImages');

// // Создаём папки
// [UPLOADS_DIR, AVATARS_DIR, PLACES_DIR].forEach(dir => {
//   if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
// });

// Хранилище для аватарок (папка по userId)
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = (req as any).user?.userId;
    if (!userId) return cb(new Error('Не авторизован'), '');
    const userDir = path.join(AVATARS_DIR, `user_${userId}`);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${Date.now()}${ext}`);
  }
});

// Хранилище для фото участков (папка по placeId)
const placeImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const placeId = req.params.placeId;
    const placeDir = path.join(PLACES_DIR, `place_${placeId}`);
    if (!fs.existsSync(placeDir)) fs.mkdirSync(placeDir, { recursive: true });
    cb(null, placeDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `photo_${Date.now()}${ext}`);
  }
});

// Ограничения
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Неверный формат. Разрешены JPG, PNG, WEBP'));
  }
});

const uploadPlaceImage = multer({
  storage: placeImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Неверный формат. Разрешены JPG, PNG, WEBP'));
  }
});

// Загрузка аватарки фермера
app.post('/api/supplier/upload-avatar',
  authenticateToken,
  requireRole(2),
  uploadAvatar.single('avatar'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Файл не загружен' });
      }
      const userId = (req as any).user.userId;
      const supplierRes = await pool.query('SELECT id FROM suppliers WHERE "userId" = $1', [userId]);
      if (supplierRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Профиль поставщика не найден' });
      }
      const supplierId = supplierRes.rows[0].id;
      const avatarUrl = `/uploads/avatars/user_${userId}/${req.file.filename}`;
      await pool.query('UPDATE suppliers SET "avatarUrl" = $1 WHERE id = $2', [avatarUrl, supplierId]);
      res.json({ success: true, avatar_url: avatarUrl });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
  }
);

// Загрузка фото участка (обложка для карточки фермера)
app.post('/api/supplier/places/:placeId/upload-image',
  authenticateToken,
  requireRole(2),
  uploadPlaceImage.single('image'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Файл не загружен' });
      }
      const placeId = parseInt(req.params.placeId);
      const userId = (req as any).user.userId;
      // Проверка прав
      const check = await pool.query(`
                SELECT sp.id FROM "supplierPlaces" sp
                JOIN suppliers s ON sp."idSupplier" = s.id
                WHERE s."userId" = $1 AND sp."idPlace" = $2
            `, [userId, placeId]);
      if (check.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Участок не принадлежит вам' });
      }
      const imageUrl = `/uploads/places/place_${placeId}/${req.file.filename}`;
      await pool.query('UPDATE places SET image_url = $1 WHERE id = $2', [imageUrl, placeId]);
      res.json({ success: true, image_url: imageUrl });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
  }
);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// // Получение аватарки фермера (с авторизацией)
// app.get('/api/supplier/avatar/:userId', authenticateToken, async (req: Request, res: Response) => {
//   try {
//     const userId = req.params.userId;
//     const currentUserId = (req as any).user.userId;
//     const userRole = (req as any).user.roleId;

//     // Разрешаем доступ самому фермеру или админу
//     if (parseInt(userId) !== currentUserId && userRole !== 1) {
//       return res.status(403).json({ success: false, message: 'Нет доступа' });
//     }

//     const query = 'SELECT avatar_url FROM suppliers WHERE userid = $1';
//     const result = await pool.query(query, [userId]);
//     if (result.rows.length === 0 || !result.rows[0].avatar_url) {
//       return res.status(404).json({ success: false, message: 'Аватарка не найдена' });
//     }

//     const avatarPath = path.join(__dirname, '..', result.rows[0].avatar_url);
//     if (!fs.existsSync(avatarPath)) {
//       return res.status(404).json({ success: false, message: 'Файл не найден' });
//     }

//     res.sendFile(avatarPath);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: 'Ошибка сервера' });
//   }
// });
app.get('/api/places/image/:placeId', async (req: Request, res: Response) => {
  try {

    //test
    const startedAt = Date.now();

    console.log('HIT /api/places/image/:placeId', req.params.placeId);

    const placeId = req.params.placeId;

    //test
    const t0 = Date.now();

    const query = 'SELECT "imageUrl" as "image_url" FROM places WHERE id = $1';
    const result = await pool.query(query, [placeId]);

    //test
    const t1 = Date.now();

    console.log('DB result:', result.rows);

    if (result.rows.length === 0 || !result.rows[0].image_url) {
      return res.status(404).json({ success: false, message: 'Фото не найдено' });
    }

    const imagePath = path.resolve(__dirname, result.rows[0].image_url.replace(/^\/+/, ''));

    //test
    const exists = fs.existsSync(imagePath);
    const t2 = Date.now();
    console.log('[place-image][timing]', {
      placeId,
      dbMs: t1 - t0,
      fileCheckMs: t2 - t1,
      totalMs: t2 - startedAt,
      exists
    });

    console.log({
      __dirname,
      dbUrl: result.rows[0].image_url,
      imagePath,
      exists: fs.existsSync(imagePath)
    });

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ success: false, message: 'Файл не найден' });
    }

    res.sendFile(imagePath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});
app.get('/api/supplier/avatar/:userId', async (req: Request, res: Response) => {
  try {
    //test
    const startedAt = Date.now();

    const userId = req.params.userId;

    //test
    const t0 = Date.now();

    const query = 'SELECT "avatarUrl" as "avatar_url" FROM suppliers WHERE "userId" = $1';
    const result = await pool.query(query, [userId]);

    //test
    const t1 = Date.now();

    console.log('AVATAR DB result:', result.rows);

    if (result.rows.length === 0 || !result.rows[0].avatar_url) {
      return res.status(404).json({ success: false, message: 'Аватарка не найдена' });
    }

    const avatarPath = path.resolve(
      __dirname,
      result.rows[0].avatar_url.replace(/^\/+/, '')
    );

    console.log({
      __dirname,
      dbUrl: result.rows[0].avatar_url,
      avatarPath,
      exists: fs.existsSync(avatarPath)
    });

    //test
    const exists = fs.existsSync(avatarPath);
    const t2 = Date.now();
    console.log('[avatar][timing]', {
      userId,
      dbMs: t1 - t0,
      fileCheckMs: t2 - t1,
      totalMs: t2 - startedAt,
      exists
    });


    if (!fs.existsSync(avatarPath)) {
      return res.status(404).json({ success: false, message: 'Файл не найден' });
    }

    res.sendFile(avatarPath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});
// const PRODUCTS_IMAGES_DIR = path.join(UPLOADS_DIR, 'productsImages');
// const PRODUCTS_IMAGES_DIR = path.join(UPLOADS_DIR, 'productsImages');
app.use('/productsImages', express.static(PRODUCTS_IMAGES_DIR));

console.log('PRODUCTS_IMAGES_DIR =', PRODUCTS_IMAGES_DIR);
console.log('onions exists =', fs.existsSync(path.join(PRODUCTS_IMAGES_DIR, 'onions.jpg')));

if (!fs.existsSync(PRODUCTS_IMAGES_DIR)) {
  fs.mkdirSync(PRODUCTS_IMAGES_DIR, { recursive: true });
}

// const productImageStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, PRODUCTS_IMAGES_DIR);
//   },
//   filename: (req, file, cb) => {
//     const productId = req.params.productId;
//     const ext = path.extname(file.originalname);
//     cb(null, `product_${productId}_${Date.now()}${ext}`);
//   }
// });

//закоментил так как сделал новые методы но насчет API поинта не знаю
// const productImageStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const productId = req.params.productId;

//     const productDir = path.join(PRODUCTS_IMAGES_DIR, `product_${productId}`);

//     // create folder if not exists
//     if (!fs.existsSync(productDir)) {
//       fs.mkdirSync(productDir, { recursive: true });
//     }

//     cb(null, productDir);
//   },

//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);

//     cb(null, `image_${Date.now()}${ext}`);
//   }
// });

// const uploadProductImage = multer({
//   storage: productImageStorage,
//   limits: { fileSize: 10 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
//     if (allowed.includes(file.mimetype)) cb(null, true);
//     else cb(new Error('Неверный формат. Разрешены JPG, PNG, WEBP'));
//   }
// });
// app.post(
//   '/api/supplier/products/:productId/upload-image',
//   authenticateToken,
//   requireRole(2),
//   uploadProductImage.single('image'),
//   async (req: Request, res: Response) => {
//     try {
//       if (!req.file) {
//         return res.status(400).json({ success: false, message: 'Файл не загружен' });
//       }

//       const productId = Number(req.params.productId);
//       const userId = (req as any).user.userId;

//       const check = await pool.query(`
//         SELECT p.id
//         FROM products p
//         JOIN "supplierPlacesProducts" spp ON spp."idProduct" = p.id
//         JOIN "supplierPlaces" sp ON sp.id = spp."idSupplierPlace"
//         JOIN suppliers s ON s.id = sp."idSupplier"
//         WHERE p.id = $1 AND s."userId" = $2
//         LIMIT 1
//       `, [productId, userId]);

//       if (check.rows.length === 0) {
//         return res.status(403).json({ success: false, message: 'Нет доступа к продукту' });
//       }

//       // const relativePath = `/productsImages/${req.file.filename}`;
//       const relativePath = `/productsImages/product_${productId}/${req.file.filename}`;

//       await pool.query(
//         `UPDATE products SET "imagePath" = $1 WHERE id = $2`,
//         [relativePath, productId]
//       );

//       return res.json({
//         success: true,
//         imagePath: relativePath
//       });
//     } catch (error) {
//       console.error(error);
//       return res.status(500).json({ success: false, message: 'Ошибка сервера' });
//     }
//   }
// );
// Публичный эндпоинт для аватарок (без авторизации)
// app.get('/api/supplier/avatar/:userId', async (req: Request, res: Response) => {
//   try {
//     const userId = req.params.userId;
//     const query = 'SELECT avatar_url FROM suppliers WHERE userid = $1';
//     const result = await pool.query(query, [userId]);
//     if (result.rows.length === 0 || !result.rows[0].avatar_url) {
//       return res.status(404).json({ success: false, message: 'Аватарка не найдена' });
//     }
//     const avatarPath = path.join(__dirname, '..', result.rows[0].avatar_url);
//     if (!fs.existsSync(avatarPath)) {
//       return res.status(404).json({ success: false, message: 'Файл не найден' });
//     }
//     res.sendFile(avatarPath);
//   } catch (error) {
//     res.status(500).json({ success: false, message: 'Ошибка сервера' });
//   }
// });
// ========== START SERVER ==========
// app.listen(port, () => {
//   console.log(`Сервер запущен на http://localhost:${port}`);
// });
const PORT = typeof port === 'string' ? parseInt(port, 10) : port;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен на http://0.0.0.0:${PORT}`);
  console.log(`📱 Доступен в локальной сети по адресу:`);

  // Показываем реальный IP
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`   http://${net.address}:${PORT}`);
      }
    }
  }
});
