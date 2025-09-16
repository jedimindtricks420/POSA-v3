import prisma from '../../prisma/client.js';

// Дашборд администратора
export const showAdminDashboard = async (req, res) => {
  try {
    // Получаем общее количество всех пользователей
    const usersCount = await prisma.user.count();

    // Получаем количество мерчантов
    const merchantsCount = await prisma.merchant.count();

    // Получаем количество продаж
    const salesCount = await prisma.sale.count();

    // Получаем количество ваучеров
    const vouchersCount = await prisma.voucher.count();

    // Получаем количество клиентов
    const clientsCount = await prisma.client.count();

    console.log('Rendering dashboard with stats:', {
      users: usersCount,
      merchants: merchantsCount,
      sales: salesCount,
      vouchers: vouchersCount,
      clients: clientsCount
    });

    // Дополнительная отладочная информация о пользователях
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: {
        role: true
      }
    });
    console.log('Users by role:', usersByRole);

    res.render('pages/dashboard-admin', {
      user: req.session.user,
      stats: {
        users: usersCount,
        vendors: merchantsCount, // Вендоры (мерчанты)
        merchants: merchantsCount, // Мерчанты (отдельный блок)
        sales: salesCount,
        vouchers: vouchersCount,
        clients: clientsCount
      }
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).send('Ошибка при загрузке данных дашборда');
  }
};