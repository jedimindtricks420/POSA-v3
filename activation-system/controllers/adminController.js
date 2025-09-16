import prisma from '../prisma/client.js';

// Отобразить дашборд админа
export const showAdminDashboard = async (req, res) => {
  try {
    // Получаем количество пользователей (vendor_user)
    const usersCount = await prisma.user.count({
      where: {
        role: 'vendor_user'
      }
    });

    // Получаем количество мерчантов
    const merchantsCount = await prisma.merchant.count();

    // Получаем количество продаж
    const salesCount = await prisma.sale.count();

    // Получаем количество ваучеров
    const vouchersCount = await prisma.voucher.count();

    res.render('pages/dashboard-admin', {
      user: req.session.user,
      stats: {
        users: usersCount,
        vendors: merchantsCount, // Показываем мерчантов как "вендоров" на UI
        sales: salesCount,
        vouchers: vouchersCount
      }
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).send('Ошибка при загрузке данных дашборда');
  }
};