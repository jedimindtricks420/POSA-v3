import prisma from '../../prisma/client.js';
import bcrypt from 'bcrypt';

// Показать форму добавления пользователя
export const showCreateUserForm = async (req, res) => {
  const kassas = await prisma.kassa.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
  res.render('pages/admin-add-user', { error: null, kassas });
};

// Обработка создания пользователя
export const handleCreateUser = async (req, res) => {
  const { username, password, role, kassaId } = req.body;
  const kassas = await prisma.kassa.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });

  if (!username || !password || !role) return res.render('pages/admin-add-user', { error: 'Заполните все поля', kassas });

  // Валидация: kassa роли требуют kassaId
  if ((role === 'kassa_admin' || role === 'kassa_viewer') && !kassaId) {
    return res.render('pages/admin-add-user', { error: 'Выберите кассу для пользователя с кассовой ролью', kassas });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const userData = { username, password: hashedPassword, role };
    if (kassaId) userData.kassaId = parseInt(kassaId);

    await prisma.user.create({ data: userData });

    if (role === 'merchant') {
      await prisma.merchant.create({ data: { username, status: 'active', legalInfo: '' } });
    }

    res.redirect('/admin/users');
  } catch (err) {
    res.render('pages/admin-add-user', { error: 'Ошибка при создании пользователя', kassas });
  }
};

// Показать список пользователей
export const showUsersList = async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
  res.render('pages/admin-users', { users, user: req.session.user });
};

// Удалить пользователя
export const deleteUser = async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: Number(req.params.id) } });
    res.redirect('/admin/users');
  } catch (err) {
    res.send('Ошибка при удалении');
  }
};

// Смена пароля
export const showChangePasswordForm = async (req, res) => {
  const userToEdit = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
  if (!userToEdit) return res.send('Пользователь не найден');
  res.render('pages/admin-change-password', { userToEdit, error: null });
};

export const changeUserPassword = async (req, res) => {
  const hashed = await bcrypt.hash(req.body.password, 10);
  await prisma.user.update({ where: { id: Number(req.params.id) }, data: { password: hashed } });
  res.redirect('/admin/users');
};
