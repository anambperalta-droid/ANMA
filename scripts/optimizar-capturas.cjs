/* Convierte las capturas de escritorio a WebP y reporta medidas.
   Correr despues de reemplazar cualquier PNG de public/screens:

     node scripts/optimizar-capturas.cjs

   Imprime el width/height real de cada una: esos son los numeros que van
   en los atributos del <img> de la landing, para que el navegador reserve
   el espacio y el bloque no salte al cargar. */
const sharp = require('C:/Users/anamb/Downloads/ANMA/anma-app/node_modules/sharp');
const fs = require('fs');
const DIR = 'C:/Users/anamb/Downloads/ANMA/anma-app/public/screens/';

const CAPTURAS = ['dashboard', 'productos', 'presupuesto', 'mensajes-wa'];

(async () => {
  let antes = 0, despues = 0;
  for (const nombre of CAPTURAS) {
    const src = DIR + nombre + '.png';
    if (!fs.existsSync(src)) { console.log(nombre + '.png — no esta, salteada'); continue; }
    const kbPng = fs.statSync(src).size / 1024;
    const info = await sharp(src).webp({ quality: 82 }).toFile(DIR + nombre + '.webp');
    antes += kbPng; despues += info.size / 1024;
    console.log(
      nombre.padEnd(14),
      (info.width + 'x' + info.height).padEnd(10),
      Math.round(kbPng) + ' KB png',
      '->', Math.round(info.size / 1024) + ' KB webp',
      '(-' + Math.round(100 - (info.size / 1024) * 100 / kbPng) + '%)'
    );
  }
  console.log('\nTotal: ' + Math.round(antes) + ' KB -> ' + Math.round(despues) + ' KB');
})();
