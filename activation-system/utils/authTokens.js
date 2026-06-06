import crypto from 'crypto';
import prisma from '../prisma/client.js';

export const SESSION_MAX_AGE = 6 * 60 * 60 * 1000; // 6 часов
export const REMEMBER_ME_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const baseCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

export function parseRememberMe(value) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  const normalized = String(value).toLowerCase();
  return normalized === '1' || normalized === 'on' || normalized === 'true';
}

export async function issueRefreshToken({ subjectType, subjectId, role }) {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REMEMBER_ME_MAX_AGE);

  if (subjectType === 'user') {
    await prisma.refreshToken.upsert({
      where: { userId_role: { userId: subjectId, role } },
      update: { token, expiresAt },
      create: { userId: subjectId, role, token, expiresAt },
    });
  } else {
    await prisma.refreshToken.upsert({
      where: { clientId_role: { clientId: subjectId, role } },
      update: { token, expiresAt },
      create: { clientId: subjectId, role, token, expiresAt },
    });
  }

  return { token, expiresAt };
}

export async function revokeRefreshTokens({ subjectType, subjectId, role }) {
  if (subjectType === 'user') {
    await prisma.refreshToken.deleteMany({ where: { userId: subjectId, role } });
  } else {
    await prisma.refreshToken.deleteMany({ where: { clientId: subjectId, role } });
  }
}

export async function revokeRefreshTokenByToken(token) {
  if (!token) return;
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function findRefreshToken(token) {
  if (!token) return null;
  return prisma.refreshToken.findUnique({ where: { token } });
}

export async function rotateRefreshToken(record) {
  if (!record) return null;
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REMEMBER_ME_MAX_AGE);

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { token, expiresAt },
  });

  return { token, expiresAt };
}

export function setRememberCookies(res, token) {
  res.cookie('refresh_token', token, { ...baseCookieOptions, maxAge: REMEMBER_ME_MAX_AGE });
  res.cookie('remember_me', '1', {
    sameSite: 'lax',
    secure: baseCookieOptions.secure,
    maxAge: REMEMBER_ME_MAX_AGE,
  });
}

export function clearRememberCookies(res) {
  res.clearCookie('refresh_token');
  res.clearCookie('remember_me');
}
