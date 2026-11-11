"use client";

import { createContext, use, useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteNavegador } from "@/lib/supabase/client";

export type Conexion = "conectando" | "en-vivo" | "reconectando";

type EnVivo = {
  conexion: Conexion;
  /** Hora del servidor al abrir el panel: lo creado después y aún nuevo se resalta. */
  abiertoDesde: number;
  nuevos: number;
};

const Contexto = createContext<EnVivo>({ conexion: "conectando", abiertoDesde: Infinity, nuevos: 0 });

export function useEnVivo(): EnVivo {
  return use(Contexto);
}

const RUTA_PEDIDOS = "/admin";
const ESPERA_MS = 400;
// El canal viejo sigue en la lista hasta que el servidor confirma su cierre: reusar el nombre al
// volver a montar (StrictMode, recargas en caliente) devolvería ese canal y `.on()` lanzaría.
let montajes = 0;

/**
 * Pedidos en vivo en todo el panel: cuenta los nuevos para la navegación y anuncia los que llegan. Solo la
 * página de pedidos se vuelve a pedir al servidor (al recibir un cambio, al volver a la pestaña y al reconectar);
 * así un formulario abierto en otra sección no se toca. Lee con la sesión: RLS deja ver `orders` solo a admins.
 */
export function PedidosEnVivo({
  abiertoDesde: abiertoAlCargar,
  nuevos: nuevosDelServidor,
  children,
}: {
  abiertoDesde: number;
  nuevos: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const [abiertoDesde] = useState(abiertoAlCargar);
  const [conexion, setConexion] = useState<Conexion>("conectando");
  const [nuevos, setNuevos] = useState(nuevosDelServidor);
  const [nuevosPrevios, setNuevosPrevios] = useState(nuevosDelServidor);
  const [anuncio, setAnuncio] = useState("");

  // Tras un refresh el layout trae la cuenta del servidor: manda sobre la del navegador.
  if (nuevosDelServidor !== nuevosPrevios) {
    setNuevosPrevios(nuevosDelServidor);
    setNuevos(nuevosDelServidor);
  }

  const actualizar = useEffectEvent(async (supabase: SupabaseClient) => {
    if (ruta === RUTA_PEDIDOS) router.refresh();
    const { count, error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("estado", "nuevo");
    if (!error && count !== null) setNuevos(count);
  });

  useEffect(() => {
    const supabase = crearClienteNavegador();
    let activo = true;
    let huboCorte = false;
    let temporizador: number | undefined;
    const programar = () => {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => actualizar(supabase), ESPERA_MS);
    };

    const canal = supabase
      .channel(`panel-pedidos-${++montajes}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (cambio) => {
        const numero = cambio.eventType === "INSERT" ? cambio.new?.numero_pedido : null;
        if (typeof numero === "string") setAnuncio(`Llegó el pedido ${numero}.`);
        programar();
      })
      .subscribe((estado) => {
        if (!activo) return;
        if (estado === "SUBSCRIBED") {
          setConexion("en-vivo");
          if (huboCorte) programar();
          huboCorte = false;
        } else {
          setConexion("reconectando");
          huboCorte = true;
        }
      });

    const alVolver = () => {
      if (document.visibilityState === "visible") programar();
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      activo = false;
      window.clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", alVolver);
      supabase.removeChannel(canal);
    };
  }, []);

  return (
    <Contexto value={{ conexion, abiertoDesde, nuevos }}>
      {children}
      <p role="status" className="sr-only">
        {anuncio}
      </p>
    </Contexto>
  );
}

const TEXTO: Record<Conexion, string> = {
  conectando: "Conectando…",
  "en-vivo": "En vivo",
  reconectando: "Reconectando…",
};

/** «En vivo»: los pedidos nuevos aparecen solos. Si se corta, lo dice en vez de quedarse callado. */
export function IndicadorEnVivo() {
  const { conexion } = useEnVivo();
  const enVivo = conexion === "en-vivo";

  return (
    <p className={`inline-flex items-center gap-2 text-sm font-medium leading-5 ${enVivo ? "text-tinta" : "text-alerta"}`}>
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${enVivo ? "bg-ahorro" : "animate-pulso bg-alerta"}`}
      />
      {TEXTO[conexion]}
      {!enVivo && <span className="sr-only">. Los pedidos nuevos pueden tardar en aparecer.</span>}
    </p>
  );
}
