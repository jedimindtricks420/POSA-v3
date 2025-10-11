import prisma from '../../prisma/client.js';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ['active', 'reserved', 'sold', 'pending', 'activated', 'deleted'];

function maskVoucherValue(value = '') {
  const raw = String(value || '').trim();
  if (raw.length <= 4) {
    return raw.replace(/.(?=..)/g, '*');
  }
  const head = raw.slice(0, 2);
  const tail = raw.slice(-2);
  return `${head}${'*'.repeat(Math.max(0, raw.length - 4))}${tail}`;
}

function buildPagination(req, total, page) {
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const params = new URLSearchParams(req.query);

  const makeUrl = (targetPage) => {
    params.set('page', String(targetPage));
    return `${req.path}?${params.toString()}`;
  };

  return {
    page,
    totalPages,
    total,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    prevUrl: page > 1 ? makeUrl(page - 1) : null,
    nextUrl: page < totalPages ? makeUrl(page + 1) : null,
  };
}

export const listVouchers = async (req, res) => {
  const user = req.session.user;
  const vendorId = user?.vendorId;

  if (!vendorId) {
    return res.status(403).send('Не удалось определить вендора для сессии');
  }

  const { status = '', productId = '', search = '', page: rawPage = '1' } = req.query;
  const page = Math.max(parseInt(rawPage, 10) || 1, 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    product: {
      vendorId,
    },
  };

  if (status && STATUS_OPTIONS.includes(status)) {
    where.status = status;
  }

  if (productId) {
    const productIdNumber = Number(productId);
    if (!Number.isNaN(productIdNumber)) {
      where.productId = productIdNumber;
    }
  }

  if (search) {
    where.value = {
      contains: search,
      mode: 'insensitive',
    };
  }

  try {
    const [products, total, vouchers] = await Promise.all([
      prisma.product.findMany({
        where: { vendorId },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
        },
      }),
      prisma.voucher.count({ where }),
      prisma.voucher.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
          voucherActivations: {
            include: {
              user: {
                select: {
                  username: true,
                },
              },
            },
            orderBy: { activatedAt: 'desc' },
            take: 1,
          },
          onlineVouchers: {
            include: {
              client: {
                select: {
                  phoneNumber: true,
                  name: true,
                },
              },
            },
            take: 1,
          },
        },
        orderBy: { id: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
    ]);

    const pagination = buildPagination(req, total, page);

    const sanitizedVouchers = vouchers.map((voucher) => ({
      ...voucher,
      maskedValue: maskVoucherValue(voucher.value),
    }));

    res.render('pages/vendor/vouchers', {
      user,
      filters: { status, productId, search },
      statusOptions: STATUS_OPTIONS,
      products,
      vouchers: sanitizedVouchers,
      pagination,
    });
  } catch (error) {
    console.error('Vendor vouchers error:', error);
    res.render('pages/vendor/vouchers', {
      user,
      filters: { status, productId, search },
      statusOptions: STATUS_OPTIONS,
      products: [],
      vouchers: [],
      pagination: buildPagination(req, 0, page),
      error: 'Не удалось загрузить список ваучеров',
    });
  }
};
