import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

export function normalizeImagePath(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  let clean = imagePath.trim().replace(/\\/g, '/');
  if (!clean) return null;
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  if (clean.startsWith('/uploads/')) return clean;
  if (clean.startsWith('/')) return `/uploads${clean}`;
  return `/uploads/${clean}`;
}

export function getAbsoluteUploadPath(publicPath: string): string | null {
  let clean = publicPath.trim().replace(/\\/g, '/');
  if (clean.startsWith('/uploads/')) clean = clean.replace(/^\/uploads\//, '');
  else clean = clean.replace(/^\/+/, '');

  const abs = path.resolve(UPLOADS_ROOT, clean);
  if (!abs.startsWith(path.resolve(UPLOADS_ROOT))) return null;
  return abs;
}

export function buildImageUrls(req: Request, imagePath?: string | null) {
  const normalized = normalizeImagePath(imagePath);
  if (!normalized) return { imageUrl: null, thumbnailUrl: null };

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return {
    imageUrl: `${baseUrl}${normalized}`,
    thumbnailUrl: `${baseUrl}/api/mobile/image-thumb?path=${encodeURIComponent(normalized)}&w=480&q=75`
  };
}

export async function sendImageThumbnail(req: Request, res: Response) {
  try {
    const imagePath = String(req.query.path || '');
    const width = Math.min(Math.max(Number(req.query.w || 480), 120), 1200);
    const quality = Math.min(Math.max(Number(req.query.q || 75), 40), 90);

    if (!imagePath) {
      return res.status(400).json({ success: false, message: 'path обязателен' });
    }

    const abs = getAbsoluteUploadPath(imagePath);
    if (!abs || !fs.existsSync(abs)) {
      return res.status(404).json({ success: false, message: 'Файл не найден' });
    }

    const buffer = await sharp(abs)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (error) {
    console.error('image-thumb error:', error);
    return res.status(500).json({ success: false, message: 'Ошибка обработки изображения' });
  }
}
