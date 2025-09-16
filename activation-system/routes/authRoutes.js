import express from 'express';
import * as authController from '../controllers/authController.js';

const router = express.Router();

router.get('/login', authController.showLoginForm);
router.post('/login', authController.handleLogin);

router.get('/logout', authController.logout);
router.get('/register', authController.showRegisterForm);
router.post('/register', authController.handleRegister);

export default router;