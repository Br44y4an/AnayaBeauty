/**
 * Cliente de Supabase para pruebas: anota cada llamada de la consulta y, al
 * esperarla, responde lo que diga `responder` según lo que se pidió.
 */

export type RespuestaFalsa = {
  data: unknown;
  error: { code?: string; message: string } | null;
  count?: number | null;
};

export type ConsultaFalsa = { origen: string; llamadas: [string, ...unknown[]][] };

export function clienteFalso(responder: (consulta: ConsultaFalsa) => RespuestaFalsa) {
  const consultas: ConsultaFalsa[] = [];

  function crear(origen: string, primera: [string, ...unknown[]]) {
    const consulta: ConsultaFalsa = { origen, llamadas: [primera] };
    consultas.push(consulta);

    const constructor: object = new Proxy(
      {},
      {
        get(_, metodo) {
          if (metodo === "then") {
            return (bien: (r: RespuestaFalsa) => unknown, mal: (e: unknown) => unknown) =>
              Promise.resolve()
                .then(() => responder(consulta))
                .then(bien, mal);
          }
          return (...args: unknown[]) => {
            consulta.llamadas.push([String(metodo), ...args]);
            return constructor;
          };
        },
      }
    );
    return constructor;
  }

  return {
    consultas,
    cliente: {
      from: (tabla: string) => crear(`from:${tabla}`, ["from", tabla]),
      rpc: (funcion: string, args?: unknown, opciones?: unknown) =>
        crear(`rpc:${funcion}`, ["rpc", funcion, args, opciones]),
    },
  };
}

/** Los argumentos de cada llamada a `metodo` dentro de una consulta. */
export function llamadas(consulta: ConsultaFalsa | undefined, metodo: string): unknown[][] {
  return (consulta?.llamadas ?? []).filter(([m]) => m === metodo).map(([, ...args]) => args);
}
