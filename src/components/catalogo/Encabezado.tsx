import Image from "next/image";

export function Encabezado() {
  return (
    <header>
      {/* El banner ya trae el logo, el mensaje de marca y el WhatsApp:
          se usa tal cual como portada, a ancho completo. */}
      <div className="relative -mx-4 overflow-hidden md:mx-0 md:rounded-tarjeta md:shadow-petalo">
        <Image
          src="/banner.jpg"
          alt="Anaya Beauty — Encuentra tus mejores productos y excelentes valores. WhatsApp +57 313 255 3660"
          width={1600}
          height={670}
          priority
          sizes="(max-width: 768px) 100vw, 1152px"
          className="h-auto w-full"
        />
      </div>

      <p className="pt-5 text-center font-display text-2xl leading-tight text-fucsia">
        Consiéntete hoy
      </p>
      <p className="pb-1 text-center text-sm text-carbon-suave">
        Mientras más llevas, mejor precio ✨
      </p>
    </header>
  );
}
