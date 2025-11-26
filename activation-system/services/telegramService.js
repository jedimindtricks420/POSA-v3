import axios from 'axios';
import prisma from '../prisma/client.js';

class TelegramService {
    /**
     * Отправить сообщение в Telegram
     * @param {string} botToken - Токен бота
     * @param {string} chatId - ID чата
     * @param {string} message - Текст сообщения
     */
    async sendMessage(botToken, chatId, message) {
        try {
            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
            const response = await axios.post(url, {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            });

            console.log(`[TelegramService] Message sent to ${chatId}:`, response.data);
            return { success: true, data: response.data };
        } catch (error) {
            console.error(`[TelegramService] Error sending message to ${chatId}:`, error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.description || error.message
            };
        }
    }

    /**
     * Отправить уведомление всем авторизованным пользователям бота
     * @param {number} botId - ID бота в базе данных
     * @param {string} message - Текст сообщения
     */
    async sendNotificationToBot(botId, message) {
        try {
            const bot = await prisma.telegramBot.findUnique({
                where: { id: botId }
            });

            if (!bot || !bot.isActive) {
                console.log(`[TelegramService] Bot ${botId} not found or inactive`);
                return { success: false, error: 'Bot not found or inactive' };
            }

            // Парсим список авторизованных пользователей
            let authorizedUsers = [];
            try {
                authorizedUsers = JSON.parse(bot.authorizedUsers);
            } catch (e) {
                // Если не JSON, пробуем разделить по запятой
                authorizedUsers = bot.authorizedUsers.split(',').map(id => id.trim()).filter(id => id);
            }

            if (authorizedUsers.length === 0) {
                console.log(`[TelegramService] No authorized users for bot ${botId}`);
                return { success: false, error: 'No authorized users' };
            }

            // Отправляем всем авторизованным пользователям
            const results = [];
            for (const chatId of authorizedUsers) {
                const result = await this.sendMessage(bot.token, chatId, message);
                results.push({ chatId, ...result });
            }

            const successCount = results.filter(r => r.success).length;
            console.log(`[TelegramService] Sent to ${successCount}/${results.length} users`);

            return {
                success: successCount > 0,
                results,
                successCount,
                totalCount: results.length
            };
        } catch (error) {
            console.error('[TelegramService] Error in sendNotificationToBot:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Отправить уведомление об активации для магазина
     * @param {number} storeId - ID магазина
     * @param {string} message - Текст сообщения
     */
    async sendNotificationToStore(storeId, message) {
        try {
            // Найти всех ботов, привязанных к этому магазину
            const storeBots = await prisma.storeTelegramBot.findMany({
                where: { storeId },
                include: { telegramBot: true }
            });

            if (storeBots.length === 0) {
                console.log(`[TelegramService] No bots configured for store ${storeId}`);
                return { success: false, error: 'No bots configured for this store' };
            }

            // Отправляем через все боты
            const results = [];
            for (const storeBot of storeBots) {
                if (storeBot.telegramBot.isActive) {
                    const result = await this.sendNotificationToBot(storeBot.telegramBotId, message);
                    results.push({ botId: storeBot.telegramBotId, ...result });
                }
            }

            const successCount = results.filter(r => r.success).length;
            return {
                success: successCount > 0,
                results,
                successCount,
                totalCount: results.length
            };
        } catch (error) {
            console.error('[TelegramService] Error in sendNotificationToStore:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Форматировать уведомление об активации
     * @param {Object} voucher - Ваучер
     * @param {Object} client - Клиент
     * @param {Object} store - Магазин
     * @param {Object} product - Продукт
     */
    formatActivationNotification(voucher, client, store, product) {
        const date = new Date().toLocaleString('ru-RU', {
            timeZone: 'Asia/Tashkent',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `🔔 <b>Новая заявка на активацию</b>

<b>Магазин:</b> ${store.name}
<b>Товар:</b> ${product.name}
<b>Код ваучера:</b> <code>${voucher.value}</code>

<b>Клиент:</b>
📱 Телефон: ${client.phoneNumber}
📅 Дата: ${date}

Для обработки перейдите в админ-панель`;
    }

    /**
     * Проверить валидность токена бота
     * @param {string} token - Токен бота
     */
    async validateBotToken(token) {
        try {
            const url = `https://api.telegram.org/bot${token}/getMe`;
            const response = await axios.get(url);
            return {
                success: true,
                botInfo: response.data.result
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.description || error.message
            };
        }
    }
}

export default new TelegramService();
