export function Insignia({
  children,
  tono = "neutro",
}: {
  children: React.ReactNode;
  tono?: "alerta" | "neutro";
}) {
  const estilo =
    tono === "alerta" ? "bg-fucsia/10 text-fucsia" : "bg-lila-suave/50 text-lila";

  return (
    <span className={`inline-block rounded-pastilla px-3 py-1 text-xs font-bold ${estilo}`}>
      {children}
    </span>
  );
}
