import prisma from '../../prisma/client.js';
import bcrypt from 'bcrypt';

// Форма смены пароля
export const showChangePasswordForm = async (req, res) => {
  const id = Number(req.params.id);
  const userToEdit = await prisma.user.findUnique({ where: { id } });
  if (!userToEdit) return res.send('Пользователь не найден');
  res.render('pages/admin-change-password', { userToEdit, error: null });
};

// Сохранить новый пароль
export const changeUserPassword = async (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body;
  if (!password) return res.send('Пароль обязателен');

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data: { password: hashed } });

  res.redirect('/admin/users');
};
