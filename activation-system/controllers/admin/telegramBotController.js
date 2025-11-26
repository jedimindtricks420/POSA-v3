import prisma from '../../prisma/client.js';
import telegramService from '../../services/telegramService.js';

// Показать список всех ботов
export const listBots = async (req, res) => {
    try {
        const bots = await prisma.telegramBot.findMany({
            include: {
                stores: {
                    include: {
                        store: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.render('pages/admin-telegram-bots', {
            bots,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error listing bots:', error);
        res.status(500).send('Ошибка при загрузке списка ботов');
    }
};

// Показать форму создания бота
export const showCreateForm = async (req, res) => {
    try {
        const stores = await prisma.store.findMany({
            orderBy: { name: 'asc' }
        });

        res.render('pages/admin-telegram-bot-form', {
            bot: null,
            stores,
            error: null,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error loading create form:', error);
        res.status(500).send('Ошибка при загрузке формы');
    }
};

// Создать бота
export const createBot = async (req, res) => {
    try {
        const { name, token, authorizedUsers, storeIds, isActive } = req.body;

        // Валидация токена
        const validation = await telegramService.validateBotToken(token);
        if (!validation.success) {
            const stores = await prisma.store.findMany({ orderBy: { name: 'asc' } });
            return res.render('pages/admin-telegram-bot-form', {
                bot: null,
                stores,
                error: `Невалидный токен бота: ${validation.error}`,
                user: req.session.user
            });
        }

        // Парсим список пользователей
        let usersArray = [];
        if (authorizedUsers) {
            usersArray = authorizedUsers.split(',').map(id => id.trim()).filter(id => id);
        }

        // Создаем бота
        const bot = await prisma.telegramBot.create({
            data: {
                name,
                token,
                authorizedUsers: JSON.stringify(usersArray),
                isActive: isActive === 'on'
            }
        });

        // Привязываем к магазинам
        if (storeIds && storeIds.length > 0) {
            const storeIdsArray = Array.isArray(storeIds) ? storeIds : [storeIds];
            await Promise.all(
                storeIdsArray.map(storeId =>
                    prisma.storeTelegramBot.create({
                        data: {
                            storeId: parseInt(storeId),
                            telegramBotId: bot.id
                        }
                    })
                )
            );
        }

        res.redirect('/admin/telegram-bots');
    } catch (error) {
        console.error('Error creating bot:', error);
        const stores = await prisma.store.findMany({ orderBy: { name: 'asc' } });
        res.render('pages/admin-telegram-bot-form', {
            bot: null,
            stores,
            error: 'Ошибка при создании бота',
            user: req.session.user
        });
    }
};

// Показать форму редактирования бота
export const showEditForm = async (req, res) => {
    try {
        const botId = parseInt(req.params.id);

        const bot = await prisma.telegramBot.findUnique({
            where: { id: botId },
            include: {
                stores: {
                    include: {
                        store: true
                    }
                }
            }
        });

        if (!bot) {
            return res.status(404).send('Бот не найден');
        }

        const stores = await prisma.store.findMany({
            orderBy: { name: 'asc' }
        });

        // Парсим авторизованных пользователей для отображения
        let usersString = '';
        try {
            const users = JSON.parse(bot.authorizedUsers);
            usersString = users.join(', ');
        } catch (e) {
            usersString = bot.authorizedUsers;
        }

        res.render('pages/admin-telegram-bot-form', {
            bot: { ...bot, authorizedUsersString: usersString },
            stores,
            error: null,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error loading edit form:', error);
        res.status(500).send('Ошибка при загрузке формы');
    }
};

// Обновить бота
export const updateBot = async (req, res) => {
    try {
        const botId = parseInt(req.params.id);
        const { name, token, authorizedUsers, storeIds, isActive } = req.body;

        // Валидация токена
        const validation = await telegramService.validateBotToken(token);
        if (!validation.success) {
            const bot = await prisma.telegramBot.findUnique({ where: { id: botId } });
            const stores = await prisma.store.findMany({ orderBy: { name: 'asc' } });
            return res.render('pages/admin-telegram-bot-form', {
                bot,
                stores,
                error: `Невалидный токен бота: ${validation.error}`,
                user: req.session.user
            });
        }

        // Парсим список пользователей
        let usersArray = [];
        if (authorizedUsers) {
            usersArray = authorizedUsers.split(',').map(id => id.trim()).filter(id => id);
        }

        // Обновляем бота
        await prisma.telegramBot.update({
            where: { id: botId },
            data: {
                name,
                token,
                authorizedUsers: JSON.stringify(usersArray),
                isActive: isActive === 'on'
            }
        });

        // Удаляем старые привязки к магазинам
        await prisma.storeTelegramBot.deleteMany({
            where: { telegramBotId: botId }
        });

        // Создаем новые привязки
        if (storeIds && storeIds.length > 0) {
            const storeIdsArray = Array.isArray(storeIds) ? storeIds : [storeIds];
            await Promise.all(
                storeIdsArray.map(storeId =>
                    prisma.storeTelegramBot.create({
                        data: {
                            storeId: parseInt(storeId),
                            telegramBotId: botId
                        }
                    })
                )
            );
        }

        res.redirect('/admin/telegram-bots');
    } catch (error) {
        console.error('Error updating bot:', error);
        res.status(500).send('Ошибка при обновлении бота');
    }
};

// Удалить бота
export const deleteBot = async (req, res) => {
    try {
        const botId = parseInt(req.params.id);

        // Удаляем бота (связи удалятся автоматически благодаря onDelete: Cascade)
        await prisma.telegramBot.delete({
            where: { id: botId }
        });

        res.redirect('/admin/telegram-bots');
    } catch (error) {
        console.error('Error deleting bot:', error);
        res.status(500).send('Ошибка при удалении бота');
    }
};

// Тестовая отправка сообщения
export const testBot = async (req, res) => {
    try {
        const botId = parseInt(req.params.id);

        const result = await telegramService.sendNotificationToBot(
            botId,
            '🧪 <b>Тестовое сообщение</b>\n\nЕсли вы видите это сообщение, бот настроен правильно!'
        );

        res.json(result);
    } catch (error) {
        console.error('Error testing bot:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
