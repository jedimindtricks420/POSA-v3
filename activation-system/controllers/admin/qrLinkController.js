import prisma from '../../prisma/client.js';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

// Страница генерации QR-кодов
export const showQrLinksPage = async (req, res) => {
    try {
        const merchants = await prisma.merchant.findMany({
            where: { status: 'active' },
            orderBy: { username: 'asc' }
        });

        const products = await prisma.product.findMany({
            where: { status: 'on' },
            include: { vendor: true },
            orderBy: { name: 'asc' }
        });

        res.render('pages/admin-qr-links', {
            merchants,
            products,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error loading QR links page:', error);
        res.status(500).send('Ошибка загрузки страницы');
    }
};

// AJAX: Генерация ссылки
export const generateLink = async (req, res) => {
    try {
        const { merchantId, productId } = req.body;

        // Проверить существующую ссылку
        let link = await prisma.merchantProductLink.findUnique({
            where: {
                merchantId_productId: {
                    merchantId: parseInt(merchantId),
                    productId: parseInt(productId)
                }
            },
            include: {
                merchant: true,
                product: { include: { vendor: true } }
            }
        });

        // Создать новую если нет
        if (!link) {
            link = await prisma.merchantProductLink.create({
                data: {
                    merchantId: parseInt(merchantId),
                    productId: parseInt(productId),
                    token: uuidv4()
                },
                include: {
                    merchant: true,
                    product: { include: { vendor: true } }
                }
            });
        }

        const baseUrl = process.env.BASE_URL || 'https://wallet.namo.uz';
        const payUrl = `${baseUrl}/pay/${link.token}`;

        // Генерация QR
        const qrDataUrl = await QRCode.toDataURL(payUrl, {
            width: 300,
            margin: 2
        });

        res.json({
            success: true,
            link: {
                id: link.id,
                token: link.token,
                url: payUrl,
                qrCode: qrDataUrl,
                merchant: link.merchant.username,
                product: link.product.name,
                price: link.product.price
            }
        });
    } catch (error) {
        console.error('Error generating link:', error);
        res.status(500).json({ success: false, error: 'Ошибка генерации' });
    }
};

// Скачать QR как PNG
export const downloadQr = async (req, res) => {
    try {
        const link = await prisma.merchantProductLink.findUnique({
            where: { id: parseInt(req.params.id) }
        });

        if (!link) {
            return res.status(404).send('Ссылка не найдена');
        }

        const baseUrl = process.env.BASE_URL || 'https://wallet.namo.uz';
        const payUrl = `${baseUrl}/pay/${link.token}`;

        const qrBuffer = await QRCode.toBuffer(payUrl, {
            width: 500,
            margin: 2
        });

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename=qr-${link.token}.png`);
        res.send(qrBuffer);
    } catch (error) {
        console.error('Error downloading QR:', error);
        res.status(500).send('Ошибка скачивания');
    }
};
