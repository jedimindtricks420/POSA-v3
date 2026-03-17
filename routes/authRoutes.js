import express from 'express';
import * as authController from '../controllers/authController.js';

import { loginLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.get('/login', authController.showLoginForm);
router.post('/login', loginLimiter, authController.handleLogin);
router.post('/refresh', authController.refreshSession);

router.get('/logout', authController.logout);
// router.get('/register', authController.showRegisterForm);
// router.post('/register', authController.handleRegister);

export default router;
