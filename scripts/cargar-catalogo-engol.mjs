/**
 * Cargue masivo desde Catalogo_Engol.xlsx: extrae las imágenes incrustadas
 * en cada fila, crea la categoría de sección (nombre de hoja) con sus
 * subcategorías (columna "Categoria") como hijas, y crea/actualiza cada
 * producto en modo borrador (activo=false, stock=0, sin precios) para que
 * se complete manualmente desde el panel de admin.
 *
 * Requiere el binario `unzip` en el PATH (un .xlsx es un .zip).
 *
 * Uso: node --env-file=.env.local scripts/cargar-catalogo-engol.mjs
 * Es seguro volver a ejecutarlo: actualiza en vez de duplicar.
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const RUTA_XLSX = path.resolve("Catalogo_Engol.xlsx");
const BUCKET = "productos";
const CARPETA_STORAGE = "catalogo-engol";
const HOJAS_A_IMPORTAR = ["Accesorios", "Cosmeticos", "Natacion"];

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---------------------------------------------------------------------
// Slug (idéntico a src/lib/slug.ts, duplicado porque este script no
// pasa por el compilador de TypeScript)
// ---------------------------------------------------------------------
function generarSlug(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------
// Parseo del XML interno del .xlsx (validado a mano contra el archivo)
// ---------------------------------------------------------------------
function unescapeXml(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

function parseSheet(xml) {
  const filas = new Map();
  const rowRe = /<row r="(\d+)"[^>]*>(.*?)<\/row>/gs;
  let m;
  while ((m = rowRe.exec(xml))) {
    const numeroFila = Number(m[1]);
    const cellRe = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs;
    const celdas = {};
    let cm;
    while ((cm = cellRe.exec(m[2]))) {
      const columna = cm[1];
      const contenido = cm[3];
      if (contenido == null) {
        celdas[columna] = "";
        continue;
      }
      const t = /<t[^>]*>(.*?)<\/t>/s.exec(contenido);
      celdas[columna] = t ? unescapeXml(t[1]).trim() : "";
    }
    filas.set(numeroFila, celdas);
  }
  return filas;
}

function parseRelaciones(xml) {
  // Los atributos Id/Target no siempre vienen en el mismo orden dentro
  // de la etiqueta, así que se extraen por separado en vez de asumir orden.
  const mapa = new Map();
  const re = /<Relationship\b[^>]*\/>/g;
  let m;
  while ((m = re.exec(xml))) {
    const etiqueta = m[0];
    const id = /\bId="(rId\d+)"/.exec(etiqueta);
    const target = /\bTarget="([^"]+)"/.exec(etiqueta);
    if (id && target) mapa.set(id[1], target[1]);
  }
  return mapa;
}

function parseAnclasDeImagen(xml) {
  const anclas = [];
  const re = /<(?:oneCellAnchor|twoCellAnchor)>(.*?)<\/(?:oneCellAnchor|twoCellAnchor)>/gs;
  let m;
  while ((m = re.exec(xml))) {
    const bloque = m[1];
    const fila = /<from>.*?<row>(\d+)<\/row>/s.exec(bloque);
    const rId = /r:embed="(rId\d+)"/.exec(bloque);
    if (fila && rId) anclas.push({ fila0: Number(fila[1]), rId: rId[1] });
  }
  return anclas;
}

// ---------------------------------------------------------------------
// 1) Extraer el .xlsx (es un .zip) a una carpeta temporal
// ---------------------------------------------------------------------
if (!existsSync(RUTA_XLSX)) {
  console.error(`✗ No se encontró ${RUTA_XLSX}`);
  process.exit(1);
}

const carpeta = mkdtempSync(path.join(tmpdir(), "cargue-engol-"));
console.log(`Extrayendo ${path.basename(RUTA_XLSX)}...`);
execFileSync("unzip", ["-o", "-q", RUTA_XLSX, "-d", carpeta]);

function leer(relPath) {
  return readFileSync(path.join(carpeta, relPath), "utf-8");
}

// Resolver hojas reales por nombre (no por número de archivo, por si el
// orden interno cambiara en una futura versión del archivo)
const workbookXml = leer("xl/workbook.xml");
const workbookRels = parseRelaciones(leer("xl/_rels/workbook.xml.rels"));
const hojasDisponibles = [...workbookXml.matchAll(/<sheet name="([^"]+)"[^>]*r:id="(rId\d+)"/g)].map(
  ([, nombre, rId]) => ({ nombre, archivo: workbookRels.get(rId).replace(/^\//, "") })
);

const hojas = hojasDisponibles.filter((h) => HOJAS_A_IMPORTAR.includes(h.nombre));
const omitidas = hojasDisponibles.filter((h) => !HOJAS_A_IMPORTAR.includes(h.nombre));
if (omitidas.length) {
  console.log(`Hojas que se omiten (no son de productos): ${omitidas.map((h) => h.nombre).join(", ")}`);
}

// ---------------------------------------------------------------------
// 2) Leer cada hoja: filas + imagen incrustada por fila
// ---------------------------------------------------------------------
const productosPorHoja = [];

for (const hoja of hojas) {
  const sheetPath = `xl/${hoja.archivo.replace(/^xl\//, "")}`;
  const filas = parseSheet(leer(sheetPath));

  const sheetRelsPath = sheetPath.replace("worksheets/", "worksheets/_rels/") + ".rels";
  const drawingTarget = parseRelaciones(leer(sheetRelsPath)).get("rId1");
  const drawingPath = "xl/" + drawingTarget.replace(/^\/?xl\//, "");
  const drawingRelsPath = drawingPath.replace("drawings/", "drawings/_rels/") + ".rels";

  const mediaPorRid = parseRelaciones(leer(drawingRelsPath));
  const anclas = parseAnclasDeImagen(leer(drawingPath));
  const imagenPorFila = new Map(anclas.map((a) => [a.fila0 + 1, mediaPorRid.get(a.rId)]));

  const filasDeDatos = [...filas.entries()].filter(([n]) => n >= 2);

  for (const [numeroFila, celda] of filasDeDatos) {
    const referencia = celda["B"];
    const descripcion = celda["C"];
    const categoria = celda["D"];
    const imagenRel = imagenPorFila.get(numeroFila);

    if (!referencia || !descripcion || !categoria || !imagenRel) {
      console.log(`⚠ Hoja "${hoja.nombre}" fila ${numeroFila}: incompleta, se omite.`);
      continue;
    }

    productosPorHoja.push({
      seccion: hoja.nombre,
      categoria,
      referenciaOriginal: referencia,
      nombre: descripcion,
      rutaImagen: path.join(carpeta, "xl", imagenRel.replace(/^\/?xl\//, "")),
      extension: path.extname(imagenRel).slice(1).toLowerCase() || "jpg",
    });
  }
}

console.log(`✓ ${productosPorHoja.length} productos leídos del Excel\n`);

// ---------------------------------------------------------------------
// 3) Referencias únicas: si el Excel repite una referencia, se sufija
//    (PRO, PRO-2, PRO-3...) para no perder ningún producto ni su foto.
// ---------------------------------------------------------------------
const conteoReferencia = new Map();
const referenciasRenombradas = [];

for (const p of productosPorHoja) {
  const veces = (conteoReferencia.get(p.referenciaOriginal) ?? 0) + 1;
  conteoReferencia.set(p.referenciaOriginal, veces);
  p.referencia = veces === 1 ? p.referenciaOriginal : `${p.referenciaOriginal}-${veces}`;
  if (veces > 1) referenciasRenombradas.push(`${p.referenciaOriginal} → ${p.referencia} (${p.nombre})`);
}

// ---------------------------------------------------------------------
// 4) Bucket de Storage para las imágenes
// ---------------------------------------------------------------------
const { data: buckets } = await db.storage.listBuckets();
if (!buckets.some((b) => b.name === BUCKET)) {
  console.log(`Creando bucket "${BUCKET}"...`);
  const { error } = await db.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    fileSizeLimit: "5MB",
  });
  if (error) throw new Error(`No se pudo crear el bucket: ${error.message}`);
  console.log(`✓ Bucket "${BUCKET}" creado (público)\n`);
} else {
  console.log(`✓ Bucket "${BUCKET}" ya existía\n`);
}

// ---------------------------------------------------------------------
// 5) Categorías: sección = categoría padre, columna Categoria = hija
// ---------------------------------------------------------------------
const { data: categoriasExistentes } = await db
  .from("categories")
  .select("id, slug, categoria_padre_id, orden");

const idPorSlug = new Map(categoriasExistentes.map((c) => [c.slug, c.id]));
let siguienteOrdenPadre = Math.max(0, ...categoriasExistentes.filter((c) => !c.categoria_padre_id).map((c) => c.orden)) + 1;

async function obtenerOCrearCategoria(nombre, categoriaPadreId, orden) {
  const slug = generarSlug(nombre);
  if (idPorSlug.has(slug)) return idPorSlug.get(slug);

  const { data, error } = await db
    .from("categories")
    .insert({ nombre, slug, categoria_padre_id: categoriaPadreId, orden })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear la categoría "${nombre}": ${error.message}`);

  idPorSlug.set(slug, data.id);
  return data.id;
}

const idCategoriaHija = new Map(); // "seccion::categoria" -> id
let categoriasNuevas = 0;

for (const seccion of hojas.map((h) => h.nombre)) {
  const yaExistiaPadre = idPorSlug.has(generarSlug(seccion));
  const idPadre = await obtenerOCrearCategoria(seccion, null, siguienteOrdenPadre);
  if (!yaExistiaPadre) {
    siguienteOrdenPadre++;
    categoriasNuevas++;
  }

  const hijasDeEstaSeccion = [
    ...new Set(productosPorHoja.filter((p) => p.seccion === seccion).map((p) => p.categoria)),
  ];

  let ordenHija = 0;
  for (const nombreHija of hijasDeEstaSeccion) {
    const slugHija = generarSlug(nombreHija);
    const yaExistiaHija = idPorSlug.has(slugHija);
    const idHija = await obtenerOCrearCategoria(nombreHija, idPadre, ordenHija);
    if (!yaExistiaHija) categoriasNuevas++;
    idCategoriaHija.set(`${seccion}::${nombreHija}`, idHija);
    ordenHija++;
  }
}

console.log(`✓ Categorías listas (${categoriasNuevas} nuevas)\n`);

// ---------------------------------------------------------------------
// 6) Subir imágenes y crear/actualizar productos, en modo borrador
// ---------------------------------------------------------------------
const { data: existentes } = await db.from("products").select("referencia");
const referenciasPrevias = new Set((existentes ?? []).map((p) => p.referencia));

let creados = 0;
let actualizados = 0;
const errores = [];

for (let i = 0; i < productosPorHoja.length; i++) {
  const p = productosPorHoja[i];
  const categoryId = idCategoriaHija.get(`${p.seccion}::${p.categoria}`);

  try {
    const bytes = readFileSync(p.rutaImagen);
    const contentType = p.extension === "png" ? "image/png" : p.extension === "webp" ? "image/webp" : "image/jpeg";
    const rutaStorage = `${CARPETA_STORAGE}/${p.referencia}.${p.extension}`;

    const { error: errorSubida } = await db.storage
      .from(BUCKET)
      .upload(rutaStorage, bytes, { contentType, upsert: true });
    if (errorSubida) throw new Error(`imagen: ${errorSubida.message}`);

    const { data: urlPublica } = db.storage.from(BUCKET).getPublicUrl(rutaStorage);

    const { error: errorProducto } = await db.from("products").upsert(
      {
        referencia: p.referencia,
        nombre: p.nombre,
        descripcion: null,
        category_id: categoryId,
        imagen_principal: urlPublica.publicUrl,
        stock: 0,
        activo: false,
        orden: i,
      },
      { onConflict: "referencia" }
    );
    if (errorProducto) throw new Error(`producto: ${errorProducto.message}`);

    if (referenciasPrevias.has(p.referencia)) actualizados++;
    else creados++;
  } catch (e) {
    errores.push(`${p.referencia} (${p.nombre}): ${e.message}`);
  }

  if ((i + 1) % 50 === 0 || i === productosPorHoja.length - 1) {
    console.log(`  ${i + 1}/${productosPorHoja.length} procesados...`);
  }
}

rmSync(carpeta, { recursive: true, force: true });

// ---------------------------------------------------------------------
// 7) Resumen
// ---------------------------------------------------------------------
console.log("\n──────────────────────────────────────────");
console.log(`✅ Cargue terminado`);
console.log(`   Creados:      ${creados}`);
console.log(`   Actualizados: ${actualizados}`);
console.log(`   Con error:    ${errores.length}`);
console.log(`   Categorías nuevas: ${categoriasNuevas}`);

if (referenciasRenombradas.length) {
  console.log(`\n⚠ Referencias repetidas en el Excel (se les agregó sufijo para no perder ninguna):`);
  for (const r of referenciasRenombradas) console.log(`   ${r}`);
}

if (errores.length) {
  console.log(`\n✗ Errores:`);
  for (const e of errores) console.log(`   ${e}`);
}

console.log(`\nTodos los productos quedaron en BORRADOR (inactivos, stock 0, sin precio).`);
console.log(`Actívalos desde el panel de admin después de ponerles precio y stock.`);

// ---------------------------------------------------------------------
// 8) Aviso informativo: referencias donde el Excel detectó el logo de
//    Engol impreso en el producto/empaque (hoja "Logo_en_producto")
// ---------------------------------------------------------------------
const hojaLogo = hojasDisponibles.find((h) => h.nombre === "Logo_en_producto");
if (hojaLogo) {
  const carpeta2 = mkdtempSync(path.join(tmpdir(), "cargue-engol-logo-"));
  execFileSync("unzip", ["-o", "-q", RUTA_XLSX, "-d", carpeta2]);
  const sheetPath = `xl/${hojaLogo.archivo.replace(/^xl\//, "")}`;
  const filas = parseSheet(readFileSync(path.join(carpeta2, sheetPath), "utf-8"));
  const refsConLogo = [...filas.entries()]
    .filter(([n]) => n >= 6)
    .map(([, c]) => c["B"])
    .filter(Boolean);
  rmSync(carpeta2, { recursive: true, force: true });

  if (refsConLogo.length) {
    console.log(
      `\nℹ En ${refsConLogo.length} referencias el Excel detectó (de forma automática, no exhaustiva) ` +
        `el logo de Engol impreso en la foto del producto o su empaque. Puede que quieras revisar esas fotos:`
    );
    console.log(`   ${refsConLogo.join(", ")}`);
  }
}
