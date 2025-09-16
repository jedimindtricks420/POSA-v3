import bcrypt from 'bcrypt';
import prisma from '../prisma/client.js';

export const showLoginForm = (req, res) => {
  res.render('pages/login', { error: null });
};

export const handleLogin = async (req, res) => {
  const { username, password } = req.body;
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


