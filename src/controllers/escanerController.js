import { Jimp } from 'jimp';
import { scanImageData } from '@undecaf/zbar-wasm';

export const leerCodigoDeImagen = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
  }

  try {
    const imagen = await Jimp.read(req.file.buffer);

    const { data, width, height } = imagen.bitmap;

    const imageData = {
      data: new Uint8ClampedArray(data),
      width,
      height
    };

    const resultados = await scanImageData(imageData);

    if (!resultados || resultados.length === 0) {
      return res.status(404).json({ error: 'No se detectó ningún código en la imagen.' });
    }

    const mejor = resultados[0];
    return res.json({
      codigo: mejor.decode(),
      tipo: mejor.typeName
    });

  } catch (err) {
    console.error('❌ Error leyendo código de imagen:', err);
    return res.status(500).json({ error: 'Error procesando la imagen.' });
  }
};
