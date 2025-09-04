import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Password from environment variable only - no defaults in code
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Ensure password is set
if (!ADMIN_PASSWORD) {
  console.error('❌ ADMIN_PASSWORD environment variable is required!');
  console.error('Please set ADMIN_PASSWORD in your .env file');
  process.exit(1);
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

// Middleware to verify JWT token
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }
    
    req.user = user;
    next();
  });
};

// Login function
export const login = async (password: string) => {
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign(
      { 
        id: 'admin', 
        username: 'admin' 
      },
      JWT_SECRET,
      { expiresIn: '24h' } // Token expires in 24 hours
    );
    
    return {
      success: true,
      token,
      user: {
        id: 'admin',
        username: 'admin'
      }
    };
  }
  
  return {
    success: false,
    error: 'Invalid password'
  };
};
