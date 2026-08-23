/**
 * Convierte un nombre en un identificador para direcciones web.
 * "Labiales Mate" → "labiales-mate", "Rubor Durazno ♡" → "rubor-durazno"
 */
export function generarSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
