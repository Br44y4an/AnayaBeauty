import Link from "next/link";
import { cerrarSesion } from "../login/actions";

const ENLACES = [
  { href: "/admin", texto: "Pedidos" },
  { href: "/admin/codigos", texto: "Códigos" },
  { href: "/admin/productos", texto: "Productos" },
  { href: "/admin/categorias", texto: "Categorías" },
  { href: "/admin/descuentos", texto: "Descuentos" },
  { href: "/admin/recibos", texto: "Recibos" },
  { href: "/admin/configuracion", texto: "Ajustes" },
  { href: "/admin/qr", texto: "QR" },
];

export const metadata = { title: "Panel — Anaya Beauty" };

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-rosa-nube">
      <header className="sticky top-0 z-20 border-b border-lila-suave bg-petalo">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <span className="shrink-0 font-display text-lg text-fucsia">Anaya</span>

          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {ENLACES.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className="min-h-[40px] cursor-pointer whitespace-nowrap rounded-pastilla
                           px-3 py-2 text-sm font-semibold text-carbon-suave transition
                           duration-200 hover:bg-rosa-nube hover:text-fucsia
                           focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-fucsia"
              >
                {e.texto}
              </Link>
            ))}
          </nav>

          <form action={cerrarSesion} className="shrink-0">
            <button className="min-h-[40px] cursor-pointer whitespace-nowrap px-2 text-xs
                               text-carbon-suave underline transition hover:text-fucsia">
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
