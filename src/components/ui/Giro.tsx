/** Indicador de carga. Con `etiqueta` se anuncia; sin ella es decorativo (p. ej. dentro de un botón con aria-busy). */
export function Giro({ className = "size-5", etiqueta }: { className?: string; etiqueta?: string }) {
  const icono = (
    <svg className={`shrink-0 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );

  if (!etiqueta) return icono;

  return (
    <span role="status" className="inline-flex items-center">
      {icono}
      <span className="sr-only">{etiqueta}</span>
    </span>
  );
}
