import prisma from '../../prisma/client.js';
import { parseReceiptSchema, renderReceiptPreview, buildSampleReceiptData } from '../../utils/receiptRenderer.js';

export const showSettings = async (req, res) => {
  const user = req.session.user;
  const vendorId = user?.vendorId;

  if (!vendorId) {
    return res.status(403).send('Не удалось определить вендора для сессии');
  }

  try {
    const vendorRecord = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        category: true,
        productType: true,
        description: true,
        balance: true,
        defaultCommissionPercent: true,
        receiptTemplate: true,
      },
    });

    const vendor = vendorRecord
      ? {
          ...vendorRecord,
          balance: Number(vendorRecord.balance ?? 0),
        }
      : {
          id: vendorId,
          name: '—',
          category: null,
          productType: null,
          description: null,
          balance: 0,
          defaultCommissionPercent: 0,
          receiptTemplate: null,
        };

    const users = await prisma.user.findMany({
      where: { vendorId },
      select: {
        id: true,
        username: true,
        note: true,
      },
      orderBy: { username: 'asc' },
    });

    let previewHtml = '';

    if (vendor?.receiptTemplate) {
      try {
        const schema = parseReceiptSchema(vendor.receiptTemplate, vendor.name);
        previewHtml = await renderReceiptPreview(
          schema,
          buildSampleReceiptData({ vendorName: vendor.name })
        );
      } catch (previewError) {
        console.error('Receipt preview error:', previewError);
      }
    }

    res.render('pages/vendor/settings', {
      user,
      vendor,
      users,
      previewHtml,
    });
  } catch (error) {
    console.error('Vendor settings error:', error);
    res.render('pages/vendor/settings', {
      user,
      vendor: {
        name: '—',
        category: null,
        productType: null,
        description: null,
        balance: 0,
        defaultCommissionPercent: 0,
      },
      users: [],
      previewHtml: '',
      error: 'Не удалось загрузить настройки вендора',
    });
  }
};
