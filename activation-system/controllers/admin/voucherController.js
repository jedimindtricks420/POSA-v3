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
  
  // Обработка массового добавления
  export const addVouchers = async (req, res) => {
    const { productId, voucherList, type } = req.body;
    const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
    const vouchers = voucherList
      .split('\n')
      .map(v => v.trim())
      .filter(v => v.length > 0)
      .map(value => ({
        value,
        status: 'active',
        productId: product.id,
        productName: product.name,
        type: type || 'Vendor'
      }));
  
    await prisma.voucher.createMany({ data: vouchers, skipDuplicates: true });
    res.redirect('/admin/vouchers');
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
  