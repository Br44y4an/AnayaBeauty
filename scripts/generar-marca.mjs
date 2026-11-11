// Genera el logotipo de la cabecera y la imagen para compartir a partir de logo.jpeg.
// Uso: node scripts/generar-marca.mjs (requiere sharp, que ya está en devDependencies).
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const ORIGEN = "logo.jpeg"; // 1254×1254, fondo blanco
const MARCA = "public/marca/anaya-beauty.png";
const OG = "src/app/opengraph-image.png";

const ZONA = { left: 90, top: 395, width: 995, height: 485 }; // «Anaya» + «— BEAUTY —»
const ALTO_MARCA = 160;
const OG_ANCHO = 1200;
const OG_ALTO = 630;

// Zonas (en coordenadas de logo.jpeg) con restos del círculo, la cola de la mariposa y la
// corona; ninguna toca letras. La rama se quita por color (lila) a la derecha del corazón.
const BORRAR = [
  (x, y) => x < 255 && y < 552,
  (x, y) => x < 262 && y > 760,
  (x, y) => x >= 462 && x <= 720 && y < 430,
];
const INICIO_RAMA = 940;

/** Opacidad de un píxel sobre blanco: 0 en el fondo, 1 en el trazo lleno. */
function opacidad(r, g, b) {
  const minimo = Math.min(r, g, b);
  return Math.min(1, Math.max(0, (245 - minimo) / (245 - 170)));
}

/** Color del trazo sin la mezcla con el blanco del fondo. */
function sinFondo(c, a) {
  return Math.round(Math.min(255, Math.max(0, (c - (1 - a) * 255) / a)));
}

function tono(r, g, b) {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Convierte el blanco en transparencia; `quitar(x, y, color)` decide qué trazos se borran. */
async function aTransparente(entrada, quitar) {
  const { data, info } = await entrada.raw().toBuffer({ resolveWithObject: true });
  const salida = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const [r, g, b] = [data[i * info.channels], data[i * info.channels + 1], data[i * info.channels + 2]];
    const a = opacidad(r, g, b);
    if (a === 0) continue;
    const color = [sinFondo(r, a), sinFondo(g, a), sinFondo(b, a)];
    if (quitar(i % info.width, Math.floor(i / info.width), color)) continue;
    salida.set([...color, Math.round(a * 255)], i * 4);
  }
  return sharp(salida, { raw: { width: info.width, height: info.height, channels: 4 } });
}

async function generarMarca() {
  const limpio = await aTransparente(sharp(ORIGEN).extract(ZONA), (x, y, [r, g, b]) => {
    const [ox, oy] = [x + ZONA.left, y + ZONA.top];
    if (BORRAR.some((zona) => zona(ox, oy))) return true;
    const h = tono(r, g, b);
    return ox >= INICIO_RAMA && h > 250 && h < 320;
  });
  const recortado = await sharp(await limpio.png().toBuffer()).trim({ threshold: 0 }).toBuffer();
  await mkdir("public/marca", { recursive: true });
  await sharp(recortado)
    .resize({ height: ALTO_MARCA, kernel: "lanczos3" })
    .png({ compressionLevel: 9, palette: true, quality: 100, colours: 128, effort: 10 })
    .toFile(MARCA);
  return sharp(MARCA).metadata();
}

async function generarImagenParaCompartir() {
  const completo = await aTransparente(sharp(ORIGEN), () => false);
  const logo = await sharp(await completo.png().toBuffer())
    .trim({ threshold: 0 })
    .resize({ width: OG_ANCHO - 120, height: OG_ALTO - 60, fit: "inside" })
    .png()
    .toBuffer();
  await sharp({ create: { width: OG_ANCHO, height: OG_ALTO, channels: 3, background: "#ffffff" } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(OG);
  return sharp(OG).metadata();
}

const marca = await generarMarca();
const og = await generarImagenParaCompartir();
console.log(`${MARCA}: ${marca.width}×${marca.height}`);
console.log(`${OG}: ${og.width}×${og.height}`);
