import prisma from '../../prisma/client.js';

// Показать всех клиентов
export const showAllClients = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    // Условие поиска
    const whereCondition = search ? {
      OR: [
        {
          phoneNumber: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    } : {};

    // Получаем клиентов с пагинацией (только основные поля)
    const clients = await prisma.client.findMany({
      where: whereCondition,
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // Получаем общее количество клиентов
    const totalClients = await prisma.client.count({
      where: whereCondition
    });

    const totalPages = Math.ceil(totalClients / limit);

    res.render('pages/admin-clients', {
      user: req.session.user,
      clients,
      currentPage: page,
      totalPages,
      totalClients,
      search,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1
    });
  } catch (error) {
    console.error('Clients Error:', error);
    res.status(500).send('Ошибка при загрузке данных клиентов');
  }
};

// Показать детали клиента
export const showClientDetails = async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!client) {
      return res.status(404).send('Клиент не найден');
    }

    res.render('pages/admin-client-details-simple', {
      user: req.session.user,
      client
    });
  } catch (error) {
    console.error('Client Details Error:', error);
    res.status(500).send('Ошибка при загрузке данных клиента');
  }
};

// Удалить клиента
export const deleteClient = async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    await prisma.client.delete({
      where: { id: clientId }
    });

    res.redirect('/admin/clients?message=Клиент успешно удален');
  } catch (error) {
    console.error('Delete Client Error:', error);
    res.redirect('/admin/clients?error=Ошибка при удалении клиента');
  }
};
