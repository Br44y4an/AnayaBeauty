/**
 * Esqueletos de carga.
 *
 * Una pantalla en blanco mientras carga se lee como "se trabó" y la
 * clienta recarga o se va. Un esqueleto con la forma de lo que viene
 * comunica "ya casi" y además reserva el espacio, así el contenido real
 * no empuja la página al aparecer (evita el salto de layout).
 */
export function Esqueleto({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`esqueleto rounded-suave ${className}`} />;
}

export function EsqueletoTarjeta() {
  return (
    <div className="overflow-hidden rounded-tarjeta bg-petalo shadow-petalo">
      <Esqueleto className="aspect-square rounded-none" />
      <div className="space-y-2 p-3">
        <Esqueleto className="h-3 w-16" />
        <Esqueleto className="h-4 w-full" />
        <Esqueleto className="h-5 w-24" />
        <Esqueleto className="h-11 w-full rounded-pastilla" />
      </div>
    </div>
  );
}

export function EsqueletoGrilla({ cantidad = 8 }: { cantidad?: number }) {
  return (
    <div
      role="status"
      aria-label="Cargando productos"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: cantidad }, (_, i) => (
        <EsqueletoTarjeta key={i} />
      ))}
    </div>
  );
}
