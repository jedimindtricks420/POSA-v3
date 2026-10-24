// Админка партнёрских сетей (Paynet UWS и аналоги): услуги, позиции, журнал.
import bcrypt from 'bcrypt';
import prisma from '../../prisma/client.js';
import { priceError, PRICE_STEP, isValidPrice } from '../../utils/priceFormat.js';
import { stockOf } from '../../services/partnerCatalogService.js';

const PARTNERS = ['PAYNET'];

// BigInt не сериализуется в шаблонах — отдаём строкой.
const txnView = (t) => ({
  ...t,
  externalTxnId: t.externalTxnId.toString(),
  amount: Number(t.amount),
  amountSums: Number(t.amount) / 100,
});

// ---------- список услуг ----------
export const showServices = async (req, res) => {
  const services = await prisma.partnerService.findMany({
    include: {
      kassa: { select: { id: true, name: true } },
      merchant: { select: { id: true, username: true } },
      _count: { select: { items: true, transactions: true } },
    },
    orderBy: [{ partner: 'asc' }, { serviceId: 'asc' }],
  });

  // Остаток по услуге = минимальный остаток среди её активных позиций:
  // именно он первым упрётся в ноль и выдаст клиенту «товар недоступен».
  const withStock = await Promise.all(services.map(async (s) => {
    const items = await prisma.partnerServiceItem.findMany({
      where: { partnerServiceId: s.id, isActive: true },
      select: { productId: true },
    });
    const stocks = await Promise.all(items.map((i) => stockOf(i.productId)));
    return { ...s, minStock: stocks.length ? Math.min(...stocks) : null };
  }));

  res.render('pages/admin-partner-list', { services: withStock, user: req.session.user });
};

// ---------- форма услуги ----------
export const showCreateForm = async (req, res) => {
  res.render('pages/admin-partner-form', {
    service: null, error: null, partners: PARTNERS,
    kassas: await prisma.kassa.findMany({ orderBy: { name: 'asc' } }),
    merchants: await prisma.merchant.findMany({ orderBy: { username: 'asc' } }),
    user: req.session.user,
  });
};

export const showEditForm = async (req, res) => {
  const service = await prisma.partnerService.findUnique({ where: { id: Number(req.params.id) } });
  if (!service) return res.redirect('/admin/partners');
  res.render('pages/admin-partner-form', {
    service, error: null, partners: PARTNERS,
    kassas: await prisma.kassa.findMany({ orderBy: { name: 'asc' } }),
    merchants: await prisma.merchant.findMany({ orderBy: { username: 'asc' } }),
    user: req.session.user,
  });
};

async function renderServiceForm(res, req, service, error) {
  return res.render('pages/admin-partner-form', {
    service, error, partners: PARTNERS,
    kassas: await prisma.kassa.findMany({ orderBy: { name: 'asc' } }),
    merchants: await prisma.merchant.findMany({ orderBy: { username: 'asc' } }),
    user: req.session.user,
  });
}

export const handleCreate = async (req, res) => {
  const { partner, serviceId, name, kassaId, merchantId, login, password } = req.body;
  const draft = { partner, serviceId, name, kassaId, merchantId, login };

  if (!PARTNERS.includes(partner)) return renderServiceForm(res, req, draft, 'Неизвестный партнёр.');
  if (!/^\d+$/.test(String(serviceId || '').trim())) return renderServiceForm(res, req, draft, 'serviceId должен быть целым числом.');
  if (!String(name || '').trim()) return renderServiceForm(res, req, draft, 'Укажите название услуги.');
  if (!String(login || '').trim()) return renderServiceForm(res, req, draft, 'Укажите логин для партнёра.');
  if (String(password || '').length < 8) return renderServiceForm(res, req, draft, 'Пароль не короче 8 символов.');
  if (!merchantId) return renderServiceForm(res, req, draft, 'Выберите мерчанта канала: на него оформляются продажи.');

  try {
    await prisma.partnerService.create({
      data: {
        partner,
        serviceId: Number(serviceId),
        name: String(name).trim(),
        kassaId: kassaId ? Number(kassaId) : null,
        merchantId: Number(merchantId),
        login: String(login).trim(),
        passwordHash: await bcrypt.hash(password, 10),
        isActive: req.body.isActive === 'on',
      },
    });
    res.redirect('/admin/partners');
  } catch (e) {
    console.error('[admin] create partner service failed:', e);
    const msg = e.code === 'P2002'
      ? 'Такой serviceId у этого партнёра или такой логин уже заняты.'
      : 'Не удалось создать услугу.';
    renderServiceForm(res, req, draft, msg);
  }
};

export const handleUpdate = async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.partnerService.findUnique({ where: { id } });
  if (!existing) return res.redirect('/admin/partners');

  const { name, kassaId, merchantId, login, password } = req.body;
  if (!String(name || '').trim()) return renderServiceForm(res, req, existing, 'Укажите название услуги.');
  if (!String(login || '').trim()) return renderServiceForm(res, req, existing, 'Укажите логин.');
  if (password && String(password).length < 8) return renderServiceForm(res, req, existing, 'Новый пароль не короче 8 символов.');
  if (!merchantId) return renderServiceForm(res, req, existing, 'Выберите мерчанта канала.');

  try {
    await prisma.partnerService.update({
      where: { id },
      data: {
        name: String(name).trim(),
        kassaId: kassaId ? Number(kassaId) : null,
        merchantId: Number(merchantId),
        login: String(login).trim(),
        isActive: req.body.isActive === 'on',
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });
    res.redirect('/admin/partners');
  } catch (e) {
    console.error('[admin] update partner service failed:', e);
    renderServiceForm(res, req, existing, e.code === 'P2002' ? 'Логин уже занят.' : 'Не удалось сохранить.');
  }
};

export const handleToggleService = async (req, res) => {
  const id = Number(req.params.id);
  const s = await prisma.partnerService.findUnique({ where: { id } });
  if (s) await prisma.partnerService.update({ where: { id }, data: { isActive: !s.isActive } });
  res.redirect('/admin/partners');
};

// ---------- позиции услуги ----------
export const showItems = async (req, res) => {
  const id = Number(req.params.id);
  const service = await prisma.partnerService.findUnique({
    where: { id },
    include: { merchant: true, kassa: true },
  });
  if (!service) return res.redirect('/admin/partners');

  const items = await prisma.partnerServiceItem.findMany({
    where: { partnerServiceId: id },
    include: { product: { select: { id: true, name: true, price: true, status: true } } },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  const rows = await Promise.all(items.map(async (it) => {
    const price = it.priceOverride ?? it.product.price;
    return {
      ...it,
      channelPrice: price,
      amountTiyin: Math.round(price * 100),
      priceOk: isValidPrice(price),
      stock: await stockOf(it.productId),
    };
  }));

  // Товар, уже подключённый к услуге, второй раз предлагать не нужно.
  const used = new Set(items.map((i) => i.productId));
  const products = (await prisma.product.findMany({
    where: { status: 'on' },
    select: { id: true, name: true, price: true },
    orderBy: { name: 'asc' },
  })).filter((p) => !used.has(p.id));

  res.render('pages/admin-partner-items', {
    service, items: rows, products, error: req.query.error || null,
    priceStep: PRICE_STEP, user: req.session.user,
  });
};

export const handleAddItem = async (req, res) => {
  const id = Number(req.params.id);
  const { productId, code, label, priceOverride, sortOrder } = req.body;
  const back = `/admin/partners/${id}/items`;
  const fail = (m) => res.redirect(`${back}?error=${encodeURIComponent(m)}`);

  if (!productId) return fail('Выберите товар.');
  if (!String(code || '').trim()) return fail('Укажите код позиции — его присылает терминал.');
  if (!String(label || '').trim()) return fail('Укажите название, которое увидит клиент.');

  let override = null;
  if (String(priceOverride || '').trim() !== '') {
    const err = priceError(priceOverride, 'Цена канала');
    if (err) return fail(err);
    override = Number(priceOverride);
  }

  try {
    await prisma.partnerServiceItem.create({
      data: {
        partnerServiceId: id,
        productId: Number(productId),
        code: String(code).trim(),
        label: String(label).trim(),
        priceOverride: override,
        sortOrder: Number(sortOrder) || 0,
        isActive: true,
      },
    });
    res.redirect(back);
  } catch (e) {
    console.error('[admin] add partner item failed:', e);
    fail(e.code === 'P2002' ? 'Такой код в этой услуге уже есть.' : 'Не удалось добавить позицию.');
  }
};

export const handleUpdateItem = async (req, res) => {
  const { id, itemId } = req.params;
  const back = `/admin/partners/${id}/items`;
  const fail = (m) => res.redirect(`${back}?error=${encodeURIComponent(m)}`);
  const { label, priceOverride, sortOrder } = req.body;

  let override = null;
  if (String(priceOverride || '').trim() !== '') {
    const err = priceError(priceOverride, 'Цена канала');
    if (err) return fail(err);
    override = Number(priceOverride);
  }

  try {
    await prisma.partnerServiceItem.update({
      where: { id: Number(itemId) },
      data: {
        ...(String(label || '').trim() ? { label: String(label).trim() } : {}),
        priceOverride: override,
        sortOrder: Number(sortOrder) || 0,
      },
    });
    res.redirect(back);
  } catch (e) {
    console.error('[admin] update partner item failed:', e);
    fail('Не удалось сохранить позицию.');
  }
};

export const handleToggleItem = async (req, res) => {
  const { id, itemId } = req.params;
  const it = await prisma.partnerServiceItem.findUnique({ where: { id: Number(itemId) } });
  if (it) await prisma.partnerServiceItem.update({ where: { id: it.id }, data: { isActive: !it.isActive } });
  res.redirect(`/admin/partners/${id}/items`);
};

// ---------- журнал транзакций канала ----------
export const showJournal = async (req, res) => {
  const { serviceId, state, phone, dateFrom, dateTo } = req.query;
  const where = {};
  if (serviceId) where.partnerServiceId = Number(serviceId);
  if (state !== undefined && state !== '') where.state = Number(state);
  if (phone) where.phone = { contains: String(phone).replace(/\D/g, '') ? String(phone).trim() : '' };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(`${dateFrom}T00:00:00`);
    if (dateTo) where.createdAt.lte = new Date(`${dateTo}T23:59:59`);
  }

  const [rows, services, totals] = await Promise.all([
    prisma.partnerTransaction.findMany({
      where,
      include: { service: { select: { name: true, partner: true, serviceId: true } } },
      orderBy: { id: 'desc' },
      take: 200,
    }),
    prisma.partnerService.findMany({ orderBy: { name: 'asc' } }),
    prisma.partnerTransaction.aggregate({ where, _count: true }),
  ]);

  // Сверять с реестром партнёра можно только проведённые: незавершённые
  // заявки выдачи не дали и в GetStatement не попадают.
  const done = await prisma.partnerTransaction.aggregate({
    where: { ...where, state: 1 }, _sum: { amount: true },
  });
  const pending = await prisma.partnerTransaction.count({ where: { ...where, state: 0 } });

  res.render('pages/admin-partner-journal', {
    rows: rows.map(txnView),
    services,
    filters: { serviceId: serviceId || '', state: state || '', phone: phone || '', dateFrom: dateFrom || '', dateTo: dateTo || '' },
    totals: {
      count: totals._count,
      doneSums: Number(done._sum.amount || 0) / 100,
      pending,
    },
    user: req.session.user,
  });
};
