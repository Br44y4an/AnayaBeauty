/** Etiquetas de caché: cada escritura del panel invalida la suya. */
export const ETIQUETA = { catalogo: "catalogo", precios: "precios", config: "config" } as const;

/** La caché sobrevive a los despliegues: súbela si cambia la forma de los datos. */
export const VERSION_DATOS = "v5";
