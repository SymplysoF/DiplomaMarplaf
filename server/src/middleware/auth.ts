import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader && authHeader.split(' ')[1];
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;

  const token = headerToken || queryToken;
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Требуется авторизация'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Неверный или просроченный токен'
      });
    }

    (req as any).user = user;
    next();
  });
};

export const checkRole = (allowedRoles: number[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Требуется авторизация'
      });
    }

    if (!allowedRoles.includes(user.roleId)) {
      const roleNames: { [key: number]: string } = {
        1: 'администратора',
        2: 'поставщика',
        3: 'покупателя'
      };

      return res.status(403).json({
        success: false,
        message: `Доступ только для ${roleNames[allowedRoles[0]] || 'определенной роли'}`
      });
    }

    next();
  };
};

export const requireRole = (requiredRoleId: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Требуется авторизация'
      });
    }

    if (user.roleId !== requiredRoleId) {
      const roleNames: { [key: number]: string } = {
        1: 'администратора',
        2: 'поставщика',
        3: 'покупателя'
      };

      return res.status(403).json({
        success: false,
        message: `Доступ только для ${roleNames[requiredRoleId] || 'определенной роли'}`
      });
    }

    next();
  };
};