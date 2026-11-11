/** Reserva el espacio de lo que viene (sin saltos al cargar) y dice «ya casi» en vez de una pantalla en blanco. */
export function Esqueleto({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`esqueleto rounded-sm ${className}`} />;
}

/** Misma forma que la tarjeta del catálogo: tesela 1:1 sin radio, textos y botón de 44 px. */
export function EsqueletoTarjeta() {
  return (
    <div>
      <Esqueleto className="aspect-square w-full rounded-none" />
      <div className="pt-2.5">
        <Esqueleto className="h-3 w-16" />
        <Esqueleto className="mt-2 h-4 w-full" />
        <Esqueleto className="mt-1 h-4 w-3/4" />
        <Esqueleto className="mt-2 h-3 w-20" />
        <Esqueleto className="mt-2 h-5 w-24" />
        <Esqueleto className="mt-2.5 h-11 w-full rounded-md" />
      </div>
    </div>
  );
}

export function EsqueletoGrilla({ cantidad = 8 }: { cantidad?: number }) {
  return (
    <div
      role="status"
      aria-label="Cargando productos"
      className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10"
    >
      {Array.from({ length: cantidad }, (_, i) => (
        <EsqueletoTarjeta key={i} />
      ))}
    </div>
  );
}
