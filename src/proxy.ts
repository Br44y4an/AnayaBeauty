import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Primera barrera del panel: sesión y fila en `administradores` (rpc es_admin). Una cuenta nueva no
// entra aunque inicie sesión. Las páginas y acciones vuelven a comprobarlo con exigirAdmin().
export async function proxy(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => peticion.cookies.getAll(),
        setAll: (aGuardar) => {
          aGuardar.forEach(({ name, value }) => peticion.cookies.set(name, value));
          respuesta = NextResponse.next({ request: peticion });
          aGuardar.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const esAdmin = user ? (await supabase.rpc("es_admin")).data === true : false;

  const esLogin = peticion.nextUrl.pathname === "/admin/login";
  if (!esLogin && !esAdmin) return redirigir(peticion, respuesta, "/admin/login");
  if (esLogin && esAdmin) return redirigir(peticion, respuesta, "/admin");
  return respuesta;
}

/** Conserva las cookies de sesión que Supabase acaba de refrescar. */
function redirigir(peticion: NextRequest, respuesta: NextResponse, ruta: string) {
  const redireccion = NextResponse.redirect(new URL(ruta, peticion.url));
  respuesta.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie));
  return redireccion;
}

export const config = {
  matcher: ["/admin/:path*"],
};
