import Link from "next/link";
import { Marca } from "@/components/ui/Marca";
import { enlaceWhatsApp } from "@/lib/whatsapp";

const ENLACE =
  "flex min-h-11 items-center text-[15px] leading-5 text-tinta underline-offset-4 hover:underline";

/** Pie de la tienda. Reserva abajo el alto de un pie fijo (ficha, bolsa), que ya incluye el área segura, o
 * solo el área segura si no hay pie fijo: nada queda debajo y el área segura no se cuenta dos veces. */
export function Pie({ whatsapp }: { whatsapp: string }) {
  return (
    <footer className="mt-12 border-t border-linea bg-fondo">
      <div
        className="mx-auto max-w-[1200px] px-4 pt-6 pb-[calc(1.5rem+max(var(--alto-pie-fijo,0px),env(safe-area-inset-bottom)))]
                   md:px-6 lg:flex lg:items-center lg:justify-between lg:gap-8 xl:px-8"
      >
        <Marca tamano="pequena" />
        <nav aria-label="Información de la tienda" className="mt-2 lg:mt-0">
          <ul className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-6">
            <li>
              <Link href="/mis-pedidos" className={ENLACE}>
                Mis pedidos
              </Link>
            </li>
            <li>
              <Link href="/privacidad" className={ENLACE}>
                Privacidad y condiciones
              </Link>
            </li>
            <li>
              <a
                href={enlaceWhatsApp("Hola, vengo del catálogo.", whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className={ENLACE}
              >
                WhatsApp
              </a>
            </li>
            <li>
              <a href="https://www.sic.gov.co" target="_blank" rel="noopener noreferrer" className={ENLACE}>
                Superintendencia de Industria y Comercio
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
