import { Router } from 'express';
import { z } from 'zod';
import { login, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Validation schema for login
const LoginSchema = z.object({
  password: z.string().min(1, 'Password is required')
});

// POST /auth/login - Login endpoint
router.post('/login', async (req, res) => {
  try {
    const validatedData = LoginSchema.parse(req.body);
    const result = await login(validatedData.password);
    
    if (result.success) {
      return res.json({
        success: true,
        token: result.token,
        user: result.user,
        message: 'Login successful'
      });
    } else {
      return res.status(401).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /auth/verify - Verify token endpoint
router.get('/verify', async (req: AuthenticatedRequest, res) => {
  // This endpoint will be protected by the auth middleware
  return res.json({
    success: true,
    message: 'Token is valid',
    user: req.user
  });
});

export default router;
