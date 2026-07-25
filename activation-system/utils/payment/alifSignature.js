import crypto from 'crypto';

/**
 * Проверка подписи вебхука Alifpay.
 * Подпись = base64( HMAC-SHA256(rawBody, secretKey) ), заголовок `Signature`.
 * rawBody должен быть точным сырым телом запроса (Buffer/string "как есть"),
 * а не результатом JSON.stringify(req.body) — при повторной сериализации
 * порядок ключей/пробелы могут отличаться от оригинала, и подпись не совпадёт.
 * @param {Buffer|String} rawBody
 * @param {String} signatureHeader
 * @param {String} secretKey
 * @returns {Boolean}
 */
export function verifyAlifSignature(rawBody, signatureHeader, secretKey) {
    if (!rawBody || !signatureHeader || !secretKey) return false;

    const expected = crypto.createHmac('sha256', secretKey).update(rawBody).digest('base64');

    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(signatureHeader);

    if (expectedBuf.length !== receivedBuf.length) return false;

    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
