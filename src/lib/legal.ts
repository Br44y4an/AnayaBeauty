/** Versión de /privacidad que acepta cada pedido (orders.politica_version): cambia si cambia el texto. */
export const VERSION_POLITICA = "2026-11-10";

export const VIGENTE_DESDE = "10 de noviembre de 2026";

// Identidad legal del responsable (Ley 1581): la completa la dueña. Lo que esté en null no se muestra.
export const RESPONSABLE: { nombre: string; nit: string | null; direccion: string | null; correo: string | null } = {
  nombre: "Anaya Beauty",
  nit: null,
  direccion: null,
  correo: null,
};
