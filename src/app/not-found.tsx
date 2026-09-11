import Link from "next/link";

export const metadata = { title: "No encontramos esta página — Anaya Beauty" };

export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-lila-suave/50 text-4xl">
        💄
      </span>

      <h1 className="font-display text-3xl text-carbon">
        Este producto ya no está
      </h1>

      <p className="text-carbon-suave">
        Puede que lo hayamos agotado o que el enlace esté viejo. Mira el
        catálogo completo: seguro hay algo que te encanta.
      </p>

      <Link
        href="/"
        className="min-h-[52px] w-full cursor-pointer rounded-pastilla bg-fucsia
                   px-6 py-3.5 text-lg font-semibold text-petalo shadow-petalo
                   transition duration-200 hover:brightness-110"
      >
        Ver el catálogo
      </Link>
    </main>
  );
}
