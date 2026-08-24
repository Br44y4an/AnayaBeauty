import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = path.resolve("logo_favicon.png");
const OUT_DIR = path.resolve("src/app");

async function main() {
  const raw = sharp(SRC);
  const meta = await raw.metadata();

  // El logo trae glow/sombra rosa suave fuera del borde solido del circulo.
  // Buscamos el circulo "solido" (alpha alto) para recortar justo a su borde,
  // en vez de al bounding box del glow, que deja aire de mas.
  const { data, info } = await raw
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const ALPHA_THRESHOLD = 200; // pixel "solido", no el glow tenue
  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * channels + 3];
      if (a >= ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  const size = Math.max(boxW, boxH);
  const cx = minX + boxW / 2;
  const cy = minY + boxH / 2;

  const left = Math.max(0, Math.round(cx - size / 2));
  const top = Math.max(0, Math.round(cy - size / 2));
  const extractSize = Math.min(size, width - left, height - top);

  const cropped = sharp(SRC).extract({
    left,
    top,
    width: extractSize,
    height: extractSize,
  });

  const sizesForIco = [16, 32, 48];
  const icoPngBuffers = await Promise.all(
    sizesForIco.map((s) =>
      cropped
        .clone()
        .resize(s, s, { fit: "cover" })
        .png()
        .toBuffer()
    )
  );
  const icoBuffer = await pngToIco(icoPngBuffers);
  await writeFile(path.join(OUT_DIR, "favicon.ico"), icoBuffer);

  await cropped
    .clone()
    .resize(512, 512, { fit: "cover" })
    .png()
    .toFile(path.join(OUT_DIR, "icon.png"));

  await cropped
    .clone()
    .resize(180, 180, { fit: "cover" })
    .png()
    .toFile(path.join(OUT_DIR, "apple-icon.png"));

  console.log("Circulo detectado:", { minX, minY, maxX, maxY, boxW, boxH });
  console.log("Recorte cuadrado:", { left, top, extractSize });
  console.log("Generados: favicon.ico, icon.png, apple-icon.png en src/app/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
