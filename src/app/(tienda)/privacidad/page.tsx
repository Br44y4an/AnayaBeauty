import type { Metadata } from "next";
import type { ReactNode } from "react";
import { estilosBoton } from "@/components/ui/Boton";
import { IconoWhatsApp } from "@/components/ui/Iconos";
import { obtenerConfiguracionPublica } from "@/lib/data/configuracion";
import { RESPONSABLE, VERSION_POLITICA, VIGENTE_DESDE } from "@/lib/legal";
import { enlaceWhatsApp } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Privacidad y condiciones",
  description: "Cómo usamos tus datos y cómo funcionan las compras en Anaya Beauty.",
};

/** «573228813646» → «+57 322 881 3646» (llega normalizado desde la configuración). */
function numeroLegible(whatsapp: string): string {
  const d = whatsapp.slice(2);
  return `+57 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

function Seccion({ id, titulo, ley, children }: { id: string; titulo: string; ley: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 border-t border-linea pt-8">
      <h2 id={id} className="text-xl font-semibold leading-[26px] text-tinta">
        {titulo}
      </h2>
      <p className="mt-1 text-[13px] leading-[18px] text-tinta-suave">{ley}</p>
      {children}
    </section>
  );
}

function Apartado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <>
      <h3 className="mt-7 text-base font-semibold leading-6 text-tinta">{titulo}</h3>
      <div className="mt-2 space-y-3">{children}</div>
    </>
  );
}

export default async function PaginaPrivacidad() {
  const { whatsappNegocio, envioInfo } = await obtenerConfiguracionPublica();
  const telefono = numeroLegible(whatsappNegocio);
  const escribir = enlaceWhatsApp("Hola, tengo una consulta sobre mis datos.", whatsappNegocio);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-4 text-base leading-6 text-tinta md:px-6 md:pt-10">
      <h1 className="text-2xl font-semibold leading-[30px] tracking-[-0.01em]">Privacidad y condiciones</h1>
      <p className="mt-2 text-[15px] leading-5 text-tinta-suave">
        Versión {VERSION_POLITICA} · Vigente desde el {VIGENTE_DESDE}.
      </p>
      <p className="mt-4">
        Aquí te contamos cómo cuidamos los datos que nos das y cómo funcionan tus compras en {RESPONSABLE.nombre}.
      </p>
      <nav aria-label="En esta página" className="mt-4 flex flex-wrap gap-x-6">
        <a href="#datos" className="flex min-h-11 items-center font-semibold underline underline-offset-4">
          Tus datos personales
        </a>
        <a href="#compras" className="flex min-h-11 items-center font-semibold underline underline-offset-4">
          Condiciones de compra
        </a>
      </nav>

      <Seccion id="datos" titulo="Tus datos personales" ley="Según la Ley 1581 de 2012 y el Decreto 1377 de 2013.">
        <Apartado titulo="Quién los recibe">
          <p>
            {RESPONSABLE.nombre} es responsable de los datos que dejas en este catálogo. Puedes escribirnos por
            WhatsApp al <span className="whitespace-nowrap tabular-nums">{telefono}</span>.
          </p>
          {(RESPONSABLE.nit || RESPONSABLE.direccion || RESPONSABLE.correo) && (
            <ul className="text-[15px] leading-5 text-tinta-suave">
              {RESPONSABLE.nit && <li>NIT {RESPONSABLE.nit}</li>}
              {RESPONSABLE.direccion && <li>{RESPONSABLE.direccion}</li>}
              {RESPONSABLE.correo && <li>{RESPONSABLE.correo}</li>}
            </ul>
          )}
        </Apartado>
        <Apartado titulo="Qué datos pedimos">
          <p>
            Para confirmar un pedido te pedimos tu nombre, tu número de WhatsApp y tu ciudad. La nota es opcional. No te
            pedimos datos de tarjetas ni de cuentas bancarias.
          </p>
        </Apartado>
        <Apartado titulo="Para qué los usamos">
          <p>
            Solo para gestionar tu pedido: confirmarlo, coordinar el pago y el envío, y responder tus preguntas. No los
            vendemos ni los usamos para publicidad. Los compartimos únicamente con quien hace falta para entregarte el
            pedido, como la transportadora, y con los servicios que alojan esta tienda.
          </p>
        </Apartado>
        <Apartado titulo="Lo que se guarda en tu celular">
          <p>
            Si marcas «Recordar mis datos en este celular», tu nombre, tu WhatsApp y tu ciudad quedan guardados en este
            navegador para tu próxima compra. Los pedidos que confirmes también se guardan aquí para que los veas en
            «Mis pedidos». Puedes borrarlos desde la configuración de tu navegador.
          </p>
        </Apartado>
        <Apartado titulo="Tus derechos">
          <p>Como titular de tus datos puedes:</p>
          <ul className="list-disc space-y-1 pl-5 marker:text-tinta-suave">
            <li>Conocerlos, actualizarlos y corregirlos.</li>
            <li>Pedir prueba de la autorización que nos diste.</li>
            <li>Saber cómo los hemos usado.</li>
            <li>Revocar la autorización o pedir que los borremos, salvo que la ley nos obligue a conservarlos.</li>
            <li>Consultarlos sin costo.</li>
            <li>Presentar quejas ante la Superintendencia de Industria y Comercio.</li>
          </ul>
        </Apartado>
        <Apartado titulo="Cómo ejercerlos">
          <p>
            Escríbenos por WhatsApp con tu nombre y lo que necesitas. Respondemos las consultas en máximo 10 días hábiles
            y los reclamos en máximo 15 días hábiles.
          </p>
          <a
            href={escribir}
            target="_blank"
            rel="noopener noreferrer"
            className={estilosBoton({ variante: "secundario", tamano: "compacto" })}
          >
            <IconoWhatsApp tamano={20} />
            Escríbenos por WhatsApp
          </a>
        </Apartado>
        <Apartado titulo="Autorización y vigencia">
          <p>
            Al confirmar un pedido aceptas que usemos tus datos para estas finalidades. Guardamos la información de tus
            pedidos mientras sea necesaria para atenderlos y para cumplir obligaciones legales, como las contables.
          </p>
        </Apartado>
      </Seccion>

      <Seccion id="compras" titulo="Condiciones de compra" ley="Según la Ley 1480 de 2011, Estatuto del Consumidor.">
        <Apartado titulo="Cómo funciona un pedido">
          <ol className="list-decimal space-y-1 pl-5 marker:font-semibold">
            <li>Eliges tus productos y confirmas el pedido aquí. Todavía no pagas nada.</li>
            <li>Te mostramos los datos para pagar por transferencia.</li>
            <li>Nos envías el comprobante de pago por WhatsApp.</li>
            <li>Coordinamos el envío contigo por WhatsApp.</li>
          </ol>
        </Apartado>
        <Apartado titulo="Precios">
          <p>
            Los precios están en pesos colombianos y bajan con la cantidad de unidades de cada producto. Los descuentos y
            el precio por mayor se aplican solos al confirmar, con los precios vigentes en ese momento.
          </p>
        </Apartado>
        <Apartado titulo="Envío">
          <p>{envioInfo}</p>
        </Apartado>
        <Apartado titulo="Cambios, devoluciones y garantía">
          <p>Si un producto llega con un defecto, escríbenos por WhatsApp con una foto y lo solucionamos según la garantía legal.</p>
          <p>
            En las compras a distancia tienes 5 días hábiles desde la entrega para retractarte (artículo 47 de la Ley
            1480 de 2011). Avísanos por WhatsApp y devuelve el producto sin usar y en las mismas condiciones en que lo
            recibiste. El envío de la devolución corre por tu cuenta y te devolvemos el dinero en máximo 30 días
            calendario. La misma ley excluye del retracto algunos casos, como los bienes de uso personal.
          </p>
        </Apartado>
        <Apartado titulo="Dudas y reclamos">
          <p>
            Escríbenos por WhatsApp al <span className="whitespace-nowrap tabular-nums">{telefono}</span>. También
            puedes acudir a la Superintendencia de Industria y Comercio en{" "}
            <a
              href="https://www.sic.gov.co"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-4"
            >
              sic.gov.co
            </a>
            .
          </p>
        </Apartado>
      </Seccion>
    </main>
  );
}
