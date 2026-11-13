const sharp = require('C:/Users/anamb/Downloads/ANMA/anma-app/node_modules/sharp');
const BASE = process.argv[2] || 'C:/Users/anamb/Downloads/ANMA/anma-app/public/screens/mano-base.png';
const DIR  = 'C:/Users/anamb/Downloads/ANMA/anma-app/public/screens/';
// Recorte: el contenido de la foto va de x192 y de y231; dejamos 64px de aire.
const CROP = { left: 128, top: 167, width: 896, height: 1369 };
// Pantalla verde dentro del recorte
const S = { x: 300 - CROP.left, y: 246 - CROP.top, w: 396, h: 829, r: 20 };
const FINAL = 680;

const piezas = [
  { src: 'mobile-analisis.png',  out: 'celu-analisis.webp',  flip: false },
  { src: 'mobile-pedido.png',    out: 'celu-pedido.webp',    flip: true  },
  { src: 'mobile-logistica.png', out: 'celu-logistica.webp', flip: false },
];
const mascara = Buffer.from(`<svg width="${S.w}" height="${S.h}"><rect width="${S.w}" height="${S.h}" rx="${S.r}" ry="${S.r}" fill="#fff"/></svg>`);

(async () => {
  const recortada = await sharp(BASE).extract(CROP).png().toBuffer();
  for (const p of piezas) {
    const pantalla = await sharp(DIR + p.src)
      .resize(S.w, S.h, { fit: 'cover', position: 'top' })
      .composite([{ input: mascara, blend: 'dest-in' }])
      .png().toBuffer();
    const base = p.flip ? await sharp(recortada).flop().png().toBuffer() : recortada;
    const x = p.flip ? CROP.width - (S.x + S.w) : S.x;
    // sharp aplica composite despues del resize: montaje y reescalado van separados.
    const montado = await sharp(base).composite([{ input: pantalla, left: x, top: S.y }]).png().toBuffer();
    const info = await sharp(montado).resize(FINAL).webp({ quality: 85 }).toFile(DIR + p.out);
    console.log(p.out, info.width + 'x' + info.height, Math.round(info.size / 1024) + ' KB');
  }
})();
