import bcrypt from 'bcrypt';
import prisma from '../prisma/client.js';
import {
  parseRememberMe,
  issueRefreshToken,
  setRememberCookies,
  clearRememberCookies,
  revokeRefreshTokens,
  revokeRefreshTokenByToken,
  findRefreshToken,
  rotateRefreshToken,
  SESSION_MAX_AGE,
  REMEMBER_ME_MAX_AGE,
} from '../utils/authTokens.js';

export const showLoginForm = (req, res) => {
  res.render('pages/login', { error: null });
};

export const handleLogin = async (req, res) => {
  const { username, password } = req.body;
  const rememberMe = parseRememberMe(req.body.rememberMe);
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.render('pages/login', { error: 'Invalid credentials' });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    vendorId: user.vendorId,
  };
  req.session.rememberMe = rememberMe;
  req.session.cookie.maxAge = rememberMe ? REMEMBER_ME_MAX_AGE : SESSION_MAX_AGE;

  if (rememberMe) {
    const { token } = await issueRefreshToken({
      subjectType: 'user',
      subjectId: user.id,
      role: user.role,
    });
    setRememberCookies(res, token);
  } else {
    await revokeRefreshTokens({ subjectType: 'user', subjectId: user.id, role: user.role });
    clearRememberCookies(res);
  }

  if (user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  } else if (user.role === 'merchant') {
    return res.redirect('/merchant/dashboard');
  } else if (user.role === 'vendor_user') {
    return res.redirect('/vendor/dashboard');
  } else {
    return res.status(403).send('Unknown role');
  }
};



export const logout = (req, res) => {
  const token = req.cookies?.refresh_token;
  if (token) {
    revokeRefreshTokenByToken(token).catch(() => {});
  }
  clearRememberCookies(res);

  const userId = req.session?.user?.id;
  const role = req.session?.user?.role;
  if (userId && role) {
    revokeRefreshTokens({ subjectType: 'user', subjectId: userId, role }).catch(() => {});
  }

  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
};

export const showRegisterForm = (req, res) => {
  res.render('pages/register', { error: null });
};

export const handleRegister = async (req, res) => {
  const { username, password, role } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({
      data: {
        username,
        password: hashed,
        role,
      },
    });
    res.redirect('/auth/login');
  } catch (error) {
    res.render('pages/register', { error: 'Пользователь уже существует' });
  }
};

export const refreshSession = async (req, res) => {
  try {
    const token = req.cookies?.refresh_token;
    const record = await findRefreshToken(token);

    if (!record || record.expiresAt < new Date() || !record.userId) {
      if (record?.id) {
        await revokeRefreshTokenByToken(token);
      }
      clearRememberCookies(res);
      return res.status(401).json({ ok: false, message: 'Token expired' });
    }

    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) {
      await revokeRefreshTokenByToken(token);
      clearRememberCookies(res);
      return res.status(401).json({ ok: false, message: 'User not found' });
    }

    req.session.regenerate(async (err) => {
      if (err) {
        return res.status(500).json({ ok: false });
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        vendorId: user.vendorId,
      };
      req.session.rememberMe = true;
      req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE;

      const rotated = await rotateRefreshToken(record);
      if (rotated) {
        setRememberCookies(res, rotated.token);
      }

      res.json({ ok: true });
    });
  } catch (error) {
    console.error('Refresh session error:', error);
    res.status(500).json({ ok: false });
  }
};
