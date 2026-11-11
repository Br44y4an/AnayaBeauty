/** Confirmación táctil corta. En iPhone y en el servidor no existe: no hace nada. */
export function vibrar(ms = 15): void {
  if (typeof navigator !== "undefined" && typeof navigator?.vibrate === "function") {
    navigator.vibrate(ms);
  }
}
