// Коды ошибок UWS (§2.5 спецификации «Универсальный WEB-сервис поставщика услуг»).
export const PAYNET_ERRORS = {
  NOT_POST:        { code: -32300, message: 'Метод запроса должен быть POST' },
  PARSE_ERROR:     { code: -32700, message: 'Ошибка парсинга JSON' },
  INVALID_REQUEST: { code: -32600, message: 'Некорректный RPC-запрос' },
  METHOD_NOT_FOUND:{ code: -32601, message: 'Запрашиваемый метод не найден' },
  NO_PARAMS:       { code: -32602, message: 'Отсутствуют обязательные поля параметров' },
  INTERNAL:        { code: -32603, message: 'Системная ошибка' },

  SERVICE_UNAVAILABLE: { code: 100, message: 'Услуга временно не поддерживается' },
  QUOTA_EXHAUSTED:     { code: 101, message: 'Квота исчерпана' },

  TXN_EXISTS:    { code: 201, message: 'Транзакция уже существует' },
  TXN_CANCELLED: { code: 202, message: 'Транзакция уже отменена' },
  TXN_NOT_FOUND: { code: 203, message: 'Транзакция не найдена' },

  PHONE_NOT_EXIST:   { code: 301, message: 'Номер не существует' },
  CLIENT_NOT_FOUND:  { code: 302, message: 'Клиент не найден' },
  PRODUCT_NOT_FOUND: { code: 304, message: 'Товар не найден' },
  SERVICE_NOT_FOUND: { code: 305, message: 'Услуга не найдена' },

  REQUIRED_MISSING: { code: 411, message: 'Не заданы один или несколько обязательных параметров' },
  BAD_CREDENTIALS:  { code: 412, message: 'Неверный логин или пароль' },
  WRONG_AMOUNT:     { code: 413, message: 'Неверная сумма' },
  BAD_DATETIME:     { code: 414, message: 'Неверный формат даты и времени' },
  AMOUNT_TOO_BIG:   { code: 415, message: 'Сумма превышает максимальный лимит' },
};

export class PaynetError extends Error {
  constructor(e, detail) {
    super(detail ? `${e.message}: ${detail}` : e.message);
    this.code = e.code;
    this.rpcMessage = e.message;
  }
}
