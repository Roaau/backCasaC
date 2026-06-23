import { Router } from 'express';
import multer from 'multer';
import { leerCodigoDeImagen } from '../controllers/escanerController.js';

const router = Router();

// Almacena la imagen en memoria (sin tocar el disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // máx 10 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes.'));
    }
    cb(null, true);
  }
});

router.post('/imagen', upload.single('imagen'), leerCodigoDeImagen);

export default router;
