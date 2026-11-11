const formateador = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});

/** Formatea un valor en pesos colombianos: 27000 → "$27.000" */
export function pesos(valor: number): string {
  return `$${formateador.format(Math.round(valor))}`;
}

const partesBogota = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  // `hour12: false` lo entiende cualquier navegador; algunos dan «24» a medianoche.
  hour12: false,
});

/**
 * Se arma a mano desde las partes: cada motor de Intl pone «de» y espacios
 * distintos, y una diferencia entre servidor y navegador rompe la hidratación.
 */
function enBogota(iso: string) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;

  const partes = partesBogota.formatToParts(fecha);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  const hora = Number(parte("hour")) % 24;

  return {
    dia: `${Number(parte("day"))} ${parte("month").replace(/\.$/, "")}`,
    hora: `${hora % 12 || 12}:${parte("minute")} ${hora < 12 ? "a. m." : "p. m."}`,
  };
}

/** "10 nov" en hora de Bogotá; "" si la fecha no sirve. */
export function fechaCorta(iso: string): string {
  return enBogota(iso)?.dia ?? "";
}

/** "10 nov, 8:42 p. m." en hora de Bogotá; "" si la fecha no sirve. */
export function fechaHora(iso: string): string {
  const f = enBogota(iso);
  return f ? `${f.dia}, ${f.hora}` : "";
}
