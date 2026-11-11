"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { Hoja } from "@/components/ui/Hoja";
import { IconoBolsa, IconoChevron, IconoPaleta, IconoPuntos, IconoRecibo, type PropsIcono } from "@/components/ui/Iconos";
import { cerrarSesion } from "../login/actions";
import { useEnVivo } from "./PedidosEnVivo";

type Destino = { href: string; texto: string; icono?: ComponentType<PropsIcono> };

const PRINCIPALES: Destino[] = [
  { href: "/admin", texto: "Pedidos", icono: IconoBolsa },
  { href: "/admin/productos", texto: "Productos", icono: IconoPaleta },
  { href: "/admin/recibos", texto: "Recibos", icono: IconoRecibo },
];

const SECUNDARIOS: Destino[] = [
  { href: "/admin/categorias", texto: "Categorías" },
  { href: "/admin/descuentos", texto: "Descuentos" },
  { href: "/admin/configuracion", texto: "Ajustes" },
  { href: "/admin/qr", texto: "Código QR" },
];

function estaEn(ruta: string, href: string): boolean {
  return href === "/admin" ? ruta === href : ruta === href || ruta.startsWith(`${href}/`);
}

/** Barra inferior de 4 destinos en el celular («Más» abre el resto) y lateral desde 1024 px. */
export function NavegacionPanel() {
  const ruta = usePathname();
  const { nuevos } = useEnVivo();
  const [masAbierto, setMasAbierto] = useState(false);
  const enSecundario = SECUNDARIOS.some((d) => estaEn(ruta, d.href));
  const cerrarMas = () => setMasAbierto(false);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-linea bg-fondo px-4 lg:hidden">
        <LogoPanel />
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-linea bg-fondo lg:flex">
        <div className="px-5 pt-6 pb-5">
          <LogoPanel />
        </div>
        <nav aria-label="Panel" className="flex-1 overflow-y-auto px-3">
          <ul className="space-y-1">
            {[...PRINCIPALES, ...SECUNDARIOS].map((d, i) => (
              <li key={d.href} className={i === PRINCIPALES.length ? "mt-3 border-t border-linea pt-3" : ""}>
                <EnlaceLateral destino={d} activo={estaEn(ruta, d.href)} nuevos={d.href === "/admin" ? nuevos : 0} />
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-1 border-t border-linea px-3 py-3">
          <EnlaceTienda className="flex min-h-11 items-center rounded-md px-3 text-[15px] font-medium text-tinta-suave hover:bg-superficie hover:text-tinta" />
          <BotonSalir className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-[15px] font-medium text-tinta-suave hover:bg-superficie hover:text-tinta" />
        </div>
      </aside>

      <nav
        aria-label="Panel"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-fondo pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {PRINCIPALES.map((d) => (
            <li key={d.href}>
              <Link href={d.href} aria-current={estaEn(ruta, d.href) ? "page" : undefined} className={pestana(estaEn(ruta, d.href))}>
                <ContenidoPestana destino={d} nuevos={d.href === "/admin" ? nuevos : 0} />
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={masAbierto}
              onClick={() => setMasAbierto(true)}
              className={`${pestana(enSecundario)} w-full cursor-pointer`}
            >
              <ContenidoPestana destino={{ href: "", texto: "Más", icono: IconoPuntos }} nuevos={0} />
            </button>
          </li>
        </ul>
      </nav>

      <Hoja abierta={masAbierto} alCerrar={cerrarMas} titulo="Más opciones">
        <ul className="-mx-2 divide-y divide-linea">
          {SECUNDARIOS.map((d) => (
            <li key={d.href}>
              <Link
                href={d.href}
                onClick={cerrarMas}
                aria-current={estaEn(ruta, d.href) ? "page" : undefined}
                className="flex min-h-13 items-center justify-between rounded-md px-2 text-base font-medium text-tinta aria-[current=page]:font-semibold"
              >
                {d.texto}
                <IconoChevron direccion="derecha" tamano={20} className="text-tinta-suave" />
              </Link>
            </li>
          ))}
          <li>
            <EnlaceTienda className="flex min-h-13 items-center px-2 text-base font-medium text-tinta" />
          </li>
          <li>
            <BotonSalir className="flex min-h-13 w-full items-center px-2 text-left text-base font-medium text-tinta" />
          </li>
        </ul>
      </Hoja>
    </>
  );
}

function pestana(activa: boolean): string {
  return (
    "relative flex min-h-16 flex-col items-center justify-center gap-1 text-[13px] leading-4 " +
    (activa
      ? "font-semibold text-tinta before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-tinta"
      : "font-medium text-tinta-suave")
  );
}

function ContenidoPestana({ destino, nuevos }: { destino: Destino; nuevos: number }) {
  const Icono = destino.icono ?? IconoPuntos;
  return (
    <>
      <span className="relative">
        <Icono tamano={24} />
        {nuevos > 0 && <Contador valor={nuevos} className="absolute -top-1.5 left-4" />}
      </span>
      {destino.texto}
      {nuevos > 0 && <span className="sr-only">, {textoNuevos(nuevos)}</span>}
    </>
  );
}

function EnlaceLateral({ destino, activo, nuevos }: { destino: Destino; activo: boolean; nuevos: number }) {
  return (
    <Link
      href={destino.href}
      aria-current={activo ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] ${
        activo ? "bg-superficie font-semibold text-tinta" : "font-medium text-tinta-suave hover:bg-superficie hover:text-tinta"
      }`}
    >
      {destino.icono && <destino.icono tamano={20} />}
      <span className="flex-1">{destino.texto}</span>
      {nuevos > 0 && (
        <>
          <Contador valor={nuevos} />
          <span className="sr-only">, {textoNuevos(nuevos)}</span>
        </>
      )}
    </Link>
  );
}

function textoNuevos(n: number): string {
  return n === 1 ? "1 nuevo" : `${n} nuevos`;
}

function Contador({ valor, className = "" }: { valor: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-tinta px-1.5 text-xs font-semibold leading-none text-fondo tabular-nums ${className}`}
    >
      {valor > 99 ? "99+" : valor}
    </span>
  );
}

/** Enlaces a la tienda en otra pestaña: dentro del panel abrirían la ficha como modal sobre él. */
function EnlaceTienda({ className }: { className: string }) {
  return (
    <a href="/" target="_blank" rel="noopener" className={className}>
      Ver la tienda
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </a>
  );
}

function BotonSalir({ className }: { className: string }) {
  return (
    <form action={cerrarSesion}>
      <button type="submit" className={`cursor-pointer ${className}`}>
        Salir
      </button>
    </form>
  );
}

function LogoPanel() {
  return (
    <span className="flex items-center gap-2.5">
      <Image src="/marca/anaya-beauty.png" alt="Anaya Beauty" width={349} height={160} unoptimized className="h-9 w-auto" />
      <span className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-tinta-suave">Panel</span>
    </span>
  );
}
