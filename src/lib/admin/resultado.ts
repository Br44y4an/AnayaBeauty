/**
 * Contrato único de las acciones del panel: nunca lanzan, devuelven el error para mostrarlo junto al
 * botón o al campo (`campos` va por el `name` del campo). React borra en producción el mensaje de una excepción.
 */
export type Resultado<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; campos?: Record<string, string> };
