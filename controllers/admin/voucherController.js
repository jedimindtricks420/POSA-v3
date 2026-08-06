import prisma from '../../prisma/client.js';

// Показать все ваучеры
export const showAllVouchers = async (req, res) => {
    const vouchers = await prisma.voucher.findMany({ orderBy: { id: 'desc' } });
    res.render('pages/admin-vouchers', { vouchers });
  };
  
  // Форма одного ваучера
  export const showAddVoucherForm = async (req, res) => {
    const products = await prisma.product.findMany({ where: { status: 'on' } });
    res.render('pages/admin-add-voucher', { products });
  };
  
  // Обработка одного ваучера
  export const handleAddVoucher = async (req, res) => {
    const { value, productId, type } = req.body;
    const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
  
    await prisma.voucher.create({
      data: {
        value,
        productId: product.id,
        productName: product.name,
        type,
        status: 'active',
      }
    });
  
    res.redirect('/admin/vouchers');
  };
  
  // Форма массового добавления
  export const showAddVouchersPage = async (req, res) => {
    const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
    res.render('pages/admin-add-vouchers', { products, user: req.session.user });
  };
  
  // Обработка массового добавления — коды можно вставить текстом (по одному на
  // строку) и/или загрузить .txt/.csv файлом; оба источника объединяются.
  const MAX_VOUCHER_LINES = 100000; // тот же лимит, что и у генератора

  export const addVouchers = async (req, res) => {
    const { productId, voucherList, type } = req.body;

    const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
    if (!product) {
      return res.status(400).send('Товар не найден');
    }

    const fileText = req.file ? req.file.buffer.toString('utf-8') : '';
    const combinedText = [voucherList || '', fileText].join('\n');

    const uniqueValues = [...new Set(
      combinedText
        .split(/\r?\n/)
        .map(v => v.trim())
        .filter(v => v.length > 0)
    )];

    if (uniqueValues.length === 0) {
      return res.status(400).send('Не найдено ни одного кода — вставьте текст или загрузите файл');
    }
    if (uniqueValues.length > MAX_VOUCHER_LINES) {
      return res.status(400).send(`Слишком много строк (${uniqueValues.length}). Максимум ${MAX_VOUCHER_LINES} за раз.`);
    }

    const vouchers = uniqueValues.map(value => ({
      value,
      status: 'active',
      productId: product.id,
      productName: product.name,
      type: type || 'Vendor'
    }));

    const result = await prisma.voucher.createMany({ data: vouchers, skipDuplicates: true });
    const skipped = uniqueValues.length - result.count;

    res.send(`
      <html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head>
      <body class="bg-slate-50 min-h-screen flex items-center justify-center">
        <div class="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h2 class="text-xl font-bold text-slate-900 mb-2">Готово</h2>
          <p class="text-slate-600">Добавлено новых кодов: <strong>${result.count}</strong></p>
          ${skipped > 0 ? `<p class="text-amber-600 text-sm mt-1">Пропущено как дубликаты: ${skipped}</p>` : ''}
          <a href="/admin/vouchers" class="mt-6 inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg">К списку ваучеров</a>
        </div>
      </body></html>
    `);
  };
  
  // Генерация ваучеров
  export const generateVouchers = async (req, res) => {
    const { productId, type, series, count } = req.body;
  
    const charset = 'ABCDEFGHJKLMNOPQRSTUVWXYZ0123456789'; // без I
    const amount = parseInt(count);
    const codeLength = 6;
    const createdCodes = new Set();
    let created = 0;
  
    function generateCode() {
      let code = '';
      while (code.length < codeLength) {
        const char = charset[Math.floor(Math.random() * charset.length)];
        code += char;
      }
      return code;
    }
  
    while (created < amount) {
      const fullCode = `${series.toUpperCase()}${generateCode()}`;
      if (createdCodes.has(fullCode)) continue;
  
      const exists = await prisma.voucher.findUnique({ where: { value: fullCode } });
      if (!exists) {
        const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
        await prisma.voucher.create({
          data: {
            value: fullCode,
            productId: product.id,
            productName: product?.name || '',
            type,
            status: 'active'
          }
        });
        createdCodes.add(fullCode);
        created++;
      }
    }
  
    res.redirect('/admin/vouchers');
  };
  