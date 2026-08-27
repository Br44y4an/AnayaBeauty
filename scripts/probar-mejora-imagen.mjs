/**
 * PILOTO (no toca producción): descarga 3 fotos ya subidas del catálogo
 * Engol, las manda a Gemini (gemini-3-pro-image-preview, alias "Nano
 * Banana Pro") pidiendo una versión profesional en 4K sin alterar el
 * producto, y guarda el resultado localmente para revisar antes de
 * gastar en las 486.
 *
 * Uso: node --env-file=.env.local scripts/probar-mejora-imagen.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.error("✗ Falta GEMINI_API_KEY en .env.local");
  process.exit(1);
}

const MODELO = "gemini-3-pro-image-preview";
const CARPETA_SALIDA = path.resolve("scripts/_piloto-imagenes");
mkdirSync(CARPETA_SALIDA, { recursive: true });

const MUESTRA = [
  { referencia: "EUP-632", nombre: "Set de brochas profesionales y pinceles X33" },
  { referencia: "SO1909", nombre: "Paleta de sombras de 65 tonos y diferentes texturas" },
  { referencia: "SY-9502", nombre: "Kit de nariguera y tapa oídos 4 colores" },
];

const URL_BASE = "https://xvqqeedtdpqlfaaicymz.supabase.co/storage/v1/object/public/productos/catalogo-engol";

const PROMPT = (nombre) => `This is a real product photo for an e-commerce catalog (product: "${nombre}").
Enhance it to professional e-commerce quality: sharpen, upscale, correct exposure and white balance,
clean/soften the background (light neutral studio background), remove obvious jpeg artifacts.
Do NOT invent, add, remove, recolor, or redesign any part of the product. Do NOT change packaging text,
logos, count of items, or shape. Keep it 100% the same real product, just a much higher quality photo of it.
Output a single square (1:1) image.`;

async function mejorarImagen({ referencia, nombre }) {
  const resOriginal = await fetch(`${URL_BASE}/${referencia}.jpeg`);
  if (!resOriginal.ok) throw new Error(`No se pudo descargar original: ${resOriginal.status}`);
  const bytesOriginal = Buffer.from(await resOriginal.arrayBuffer());
  writeFileSync(path.join(CARPETA_SALIDA, `${referencia}-original.jpeg`), bytesOriginal);

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT(nombre) },
          { inline_data: { mime_type: "image/jpeg", data: bytesOriginal.toString("base64") } },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { imageSize: "4K", aspectRatio: "1:1" },
    },
  };

  const inicio = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify(body),
    }
  );

  const json = await res.json();
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

  if (!res.ok) {
    console.log(`✗ ${referencia}: HTTP ${res.status} (${segundos}s)`);
    console.log(JSON.stringify(json, null, 2).slice(0, 1500));
    return;
  }

  const partes = json.candidates?.[0]?.content?.parts ?? [];
  const parteImagen = partes.find((p) => p.inlineData || p.inline_data);
  const datos = parteImagen?.inlineData?.data ?? parteImagen?.inline_data?.data;
  const mime = parteImagen?.inlineData?.mimeType ?? parteImagen?.inline_data?.mime_type ?? "image/png";

  if (!datos) {
    console.log(`✗ ${referencia}: la respuesta no trajo imagen (${segundos}s)`);
    console.log(JSON.stringify(json, null, 2).slice(0, 1500));
    return;
  }

  const ext = mime.includes("png") ? "png" : "jpg";
  const bytesSalida = Buffer.from(datos, "base64");
  const rutaSalida = path.join(CARPETA_SALIDA, `${referencia}-mejorada.${ext}`);
  writeFileSync(rutaSalida, bytesSalida);

  console.log(
    `✓ ${referencia}: ${(bytesOriginal.length / 1024).toFixed(0)}KB → ${(bytesSalida.length / 1024).toFixed(0)}KB` +
      ` (${segundos}s) tokens: ${JSON.stringify(json.usageMetadata ?? {})}`
  );
}

for (const p of MUESTRA) {
  try {
    await mejorarImagen(p);
  } catch (e) {
    console.log(`✗ ${p.referencia}: ${e.message}`);
  }
}

console.log(`\nRevisa las imágenes en: ${CARPETA_SALIDA}`);
