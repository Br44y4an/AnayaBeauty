import Image from "next/image";

/**
 * Portada del catálogo.
 *
 * El banner se recorta en celular (`max-h` + `object-cover`) en vez de
 * ocupar toda su altura: con la proporción original, en un teléfono no
 * cabía ni un producto en la primera pantalla y había que hacer scroll a
 * ciegas para ver que esto era una tienda.
 */
export function Encabezado() {
  return (
    <header>
      <div className="relative -mx-4 overflow-hidden md:mx-0 md:rounded-tarjeta md:shadow-petalo">
        <Image
          src="/banner.png"
          alt="Anaya Beauty — Encuentra tus mejores productos y excelentes valores. WhatsApp +57 322 881 3646"
          width={1600}
          height={670}
          preload
          sizes="(max-width: 768px) 100vw, 1152px"
          className="max-h-[38vh] w-full object-cover md:max-h-none"
        />
      </div>

      <h1 className="pt-4 text-center font-display text-2xl leading-tight text-fucsia-texto">
        Consiéntete hoy
      </h1>
      <p className="text-center text-carbon-suave">
        Arma tu pedido y confírmalo en un minuto ✨
      </p>
    </header>
  );
}
