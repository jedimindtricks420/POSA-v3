import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,       // mail.keyspro.uz
  port: parseInt(process.env.EMAIL_PORT), // 465
  secure: true, // обязательно true для SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

export const sendActivationKeyEmail = async (to, key) => {
  await transporter.sendMail({
    from: `"Activation System" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Ваш ключ активации',
    html: `<p>Здравствуйте!</p>
           <p>Вот ваш ключ активации: <strong>${key}</strong></p>
           <p>Спасибо за покупку!</p>`,
  });
};
