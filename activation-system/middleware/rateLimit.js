import rateLimit from 'express-rate-limit';

// 1. Protection for Login (Auth)
// Safe Limit: 20 attempts per 15 minutes.
// Why safe: A real human might mistype a password 3-5 times. 20 is plenty, but stops a bot trying 1000 passwords.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Слишком много попыток входа. Пожалуйста, подождите 15 минут.',
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Protection for Voucher Activation (Anti-Guessing)
// Safe Limit: 10 checks per 1 hour per IP.
// Why safe: A user receives 1-2 vouchers. checking 10 distinct codes is suspicious behavior (guessing).
export const activationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Слишком много попыток активации. Попробуйте позже.',
  standardHeaders: true,
  legacyHeaders: false,
});

// 3. Protection for Voucher Generation (Anti-DDoS / Heavy Load)
// Safe Limit: 5 requests per 1 hour.
// Why safe: Generating a batch of vouchers is an administrative task done rarely.
export const generationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Слишком частая генерация ваучеров. Подождите.',
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. Protection for OTP Verification (Anti-Brute-Force)
// Safe Limit: 5 attempts per 15 minutes per IP.
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Слишком много неверных попыток. Подождите 15 минут.',
  standardHeaders: true,
  legacyHeaders: false,
});

// 5. Protection for Client Registration (Anti-Spam)
// Safe Limit: 5 registrations per hour per IP.
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Слишком много попыток регистрации. Попробуйте позже.',
  standardHeaders: true,
  legacyHeaders: false,
});
