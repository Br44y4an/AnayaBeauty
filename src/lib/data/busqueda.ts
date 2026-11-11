/**
 * Filtro `or()` de PostgREST para el panel. El valor va entre comillas porque
 * la coma separa condiciones («base, matte» daba un 500), y `%` y `_` se
 * escapan porque en `ilike` son comodines, no texto («A_1» traía «A11»).
 */

const COLUMNAS_POR_DEFECTO = ["nombre", "referencia"];

/** Escapa lo que en `ilike` significa "cualquier cosa". */
function escaparComodines(texto: string): string {
  // La barra invertida va primero: si no, escaparía las barras que
  // añaden los reemplazos siguientes.
  return texto
    .split("\\")
    .join("\\\\")
    .split("%")
    .join("\\%")
    .split("_")
    .join("\\_");
}

/** Escapa lo que rompería las comillas del valor de PostgREST. */
function escaparComillas(texto: string): string {
  return texto.split('"').join('\\"');
}

/** Arma el argumento de `.or()` buscando `texto` en cada columna. */
export function filtroBusqueda(
  texto: string,
  columnas: string[] = COLUMNAS_POR_DEFECTO
): string {
  const patron = escaparComillas(`%${escaparComodines(texto.trim())}%`);
  return columnas.map((columna) => `${columna}.ilike."${patron}"`).join(",");
}

/* Búsqueda de la tienda: cada grupo es una palabra que el producto debe
   contener; sus alternativas van unidas por «|». `buscar_productos` (SQL)
   las compara con el mismo texto normalizado y con la referencia compacta. */

const MAX_GRUPOS = 5;

const VACIAS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "en", "con", "para", "por", "un", "una",
]);

const SINONIMOS = [
  ["rimel", "mascara", "pestanina"],
  ["blush", "rubor"],
  ["gloss", "brillo"],
  ["neceser", "cosmetiquera"],
  ["labial", "lipstick"],
  ["delineador", "delineadora"],
  ["corrector", "concealer"],
  ["iluminador", "highlighter"],
];

/** Sin tildes ni mayúsculas, igual que `normalizar()` en la base. */
export function normalizarTexto(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** "USK-621" → "usk621": así se comparan referencias escritas de cualquier forma. */
export function compactarReferencia(s: string): string {
  return normalizarTexto(s).replace(/[^a-z0-9]/g, "");
}

/** Singular aproximado; solo en palabras, para no recortar referencias. */
function singular(palabra: string): string {
  if (!/^[a-z]+$/.test(palabra)) return palabra;
  if (palabra.length > 4 && palabra.endsWith("ces")) return `${palabra.slice(0, -3)}z`;
  if (palabra.length > 6 && palabra.endsWith("es")) return palabra.slice(0, -2);
  if (palabra.length > 4 && palabra.endsWith("s")) return palabra.slice(0, -1);
  return palabra;
}

export function gruposDeBusqueda(q: string): string[] {
  const grupos = new Set<string>();

  for (const palabra of normalizarTexto(q).split(/[^a-z0-9]+/)) {
    if (palabra.length < 2 || VACIAS.has(palabra)) continue;

    const base = singular(palabra);
    const sinonimos = SINONIMOS.find((g) => g.includes(palabra) || g.includes(base));
    grupos.add(sinonimos ? sinonimos.join("|") : base);
  }

  return [...grupos].slice(0, MAX_GRUPOS);
}

type CamposVisibles = {
  nombre: string;
  referencia: string;
  categoria?: string | null;
  departamento?: string | null;
};

/** Cada grupo tiene alguna alternativa en el texto o en la referencia compacta (como `buscar_productos`). */
function cubreTodos(grupos: string[], texto: string, compacta: string): boolean {
  return grupos.every((grupo) =>
    grupo.split("|").some((a) => {
      const alternativa = a.trim();
      return alternativa !== "" && (texto.includes(alternativa) || compacta.includes(alternativa));
    })
  );
}

/**
 * Relevancia de un producto que ya coincidió en la base: 0 si su referencia es lo buscado, 1 si todo está
 * en el nombre o la referencia, 2 si hace falta su categoría o departamento, 3 si solo coincide por lo que
 * la tarjeta no muestra (descripción, variantes).
 */
export function nivelDeCoincidencia(p: CamposVisibles, grupos: string[], q: string): 0 | 1 | 2 | 3 {
  const compacta = compactarReferencia(p.referencia);
  const buscada = compactarReferencia(q);
  if (buscada !== "" && compacta === buscada) return 0;

  const propio = normalizarTexto(`${p.nombre} ${p.referencia}`);
  if (cubreTodos(grupos, propio, compacta)) return 1;
  const conCategoria = normalizarTexto(`${propio} ${p.categoria ?? ""} ${p.departamento ?? ""}`);
  return cubreTodos(grupos, conCategoria, compacta) ? 2 : 3;
}
