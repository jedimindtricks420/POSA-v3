import { activateVoucherForVendor, ActivationError } from '../../services/voucherActivationService.js';

function buildViewModel({ user, form = {}, error = null, success = null }) {
  return {
    user,
    form: {
      code: form.code ?? '',
    },
    error,
    success,
  };
}

export const showActivationForm = (req, res) => {
  const user = req.session.user;
  res.render('pages/vendor/activate', buildViewModel({ user }));
};

export const handleActivation = async (req, res) => {
  const user = req.session.user;
  const vendorId = user?.vendorId;

  if (!vendorId) {
    return res.status(403).send('Не удалось определить вендора для сессии');
  }

  const code = (req.body?.code || '').trim();

  if (!code) {
    return res.render('pages/vendor/activate', buildViewModel({
      user,
      form: { code },
      error: 'Введите код ваучера',
    }));
  }

  try {
    const result = await activateVoucherForVendor({
      voucherCode: code,
      vendorId,
      userId: user?.id,
    });

    const successPayload = {
      code: result.voucher.value,
      productName: result.productName,
      activationKey: result.activationKey || result.voucher.value,
    };

    res.render('pages/vendor/activate', buildViewModel({
      user,
      success: successPayload,
    }));
  } catch (error) {
    if (error instanceof ActivationError) {
      return res.render('pages/vendor/activate', buildViewModel({
        user,
        form: { code },
        error: error.message,
      }));
    }
    console.error('Vendor activation error:', error);
    res.render('pages/vendor/activate', buildViewModel({
      user,
      form: { code },
      error: 'Не удалось активировать ваучер. Попробуйте ещё раз или обратитесь к администратору.',
    }));
  }
};
