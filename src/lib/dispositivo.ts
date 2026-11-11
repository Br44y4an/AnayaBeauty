/** Confirmación táctil corta. En iPhone y en el servidor no existe: no hace nada. */
export function vibrar(ms = 15): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(ms);
  }
}
