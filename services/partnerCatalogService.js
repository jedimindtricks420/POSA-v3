// Справочник партнёрских сетей: услуга (бренд) -> позиции -> товар в POSA.
import prisma from '../prisma/client.js';
import { isValidPrice } from '../utils/priceFormat.js';

export async function findServiceByLogin(partner, login) {
  if (!login) return null;
  const svc = await prisma.partnerService.findUnique({ where: { login } });
  if (!svc || svc.partner !== partner || !svc.isActive) return null;
  return svc;
}

export async function listItems(service) {
  const items = await prisma.partnerServiceItem.findMany({
    where: { partnerServiceId: service.id, isActive: true, product: { status: 'on' } },
    include: { product: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  const rows = await Promise.all(items.map(async (it) => {
    const price = effectivePrice(it);
    if (!isValidPrice(price)) {
      console.error(`[UWS] позиция "${it.code}" скрыта из каталога: цена ${price} некорректна`);
      return null;
    }
    return {
      code: it.code,
      label: it.label,
      price,                              // сумы, цена канала
      amount: toTiyin(price),             // тийины, столько спишет терминал
      available: await stockOf(it.productId),
    };
  }));
  return rows.filter(Boolean);
}

// Цена для канала: явная цена позиции, иначе цена товара. Обе кратны
// PRICE_STEP (это гарантирует валидация при создании), поэтому никакого
// округления на лету и никакой разницы для доучёта здесь нет.
export function effectivePrice(item) {
  return item.priceOverride ?? item.product.price;
}

export const toTiyin = (sums) => Math.round(sums * 100);

export async function resolveItem(partnerServiceId, code) {
  if (code == null || String(code).trim() === '') return null;
  const item = await prisma.partnerServiceItem.findUnique({
    where: { partnerServiceId_code: { partnerServiceId, code: String(code).trim() } },
    include: { product: { include: { vendor: { include: { kassa: true } } } } },
  });
  if (!item || !item.isActive || item.product.status !== 'on') return null;
  return item;
}

export const stockOf = (productId) =>
  prisma.voucher.count({ where: { productId, status: 'active' } });

// Касса канала: приоритет у услуги (контракта), затем товар, затем вендор.
export function resolveKassaId(service, product) {
  return service.kassaId ?? product.kassaId ?? product.vendor?.kassaId ?? null;
}
