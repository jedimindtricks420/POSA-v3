import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadDir = 'public/uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Only images are allowed!'));
    }
};

export const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// Отдельная папка для изображений товаров — живут отдельно от прочих загрузок
const productImagesDir = 'public/uploads/products';
if (!fs.existsSync(productImagesDir)) {
    fs.mkdirSync(productImagesDir, { recursive: true });
}

const productImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, productImagesDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

export const uploadProductImage = multer({
    storage: productImageStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// Импорт списка ваучеров (.txt/.csv) — только в памяти, на диск не пишем:
// это не публичный ассет, а разовый файл с кодами (в т.ч. реальными,
// купленными во внешних сервисах вроде 1PDF), хранить его на сервере не нужно.
const voucherFileFilter = (req, file, cb) => {
    const ok = /\.(txt|csv)$/i.test(file.originalname);
    if (ok) return cb(null, true);
    cb(new Error('Разрешены только файлы .txt или .csv'));
};

export const uploadVoucherFile = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB — с запасом на десятки тысяч строк
    fileFilter: voucherFileFilter
});
