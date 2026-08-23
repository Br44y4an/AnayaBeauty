import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(peticion: NextRequest) {
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
          aGuardar.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = peticion.nextUrl.pathname;
  const esLogin = ruta === "/admin/login";

  if (!esLogin && !user) {
    return NextResponse.redirect(new URL("/admin/login", peticion.url));
  }
  if (esLogin && user) {
    return NextResponse.redirect(new URL("/admin", peticion.url));
  }

  return respuesta;
}

export const config = {
  matcher: ["/admin/:path*"],
};
