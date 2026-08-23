/**
 * Carga productos de ejemplo para desarrollo.
 * Uso: node --env-file=.env.local scripts/sembrar-ejemplo.mjs
 *
 * Es seguro volver a ejecutarlo: actualiza en vez de duplicar.
 */
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const CATEGORIAS = [
  { nombre: "Labiales", slug: "labiales", orden: 1 },
  { nombre: "Rostro", slug: "rostro", orden: 2 },
  { nombre: "Ojos", slug: "ojos", orden: 3 },
  { nombre: "Accesorios", slug: "accesorios", orden: 4 },
];

const PRODUCTOS = [
  { referencia: "REF-101", nombre: "Labial Rojo Pasión", descripcion: "Mate de larga duración, no transfiere.", categoria: "labiales", stock: 12, escalones: [[1, 10000], [3, 9000], [6, 8000]] },
  { referencia: "REF-102", nombre: "Labial Nude Suave", descripcion: "Acabado satinado, tono universal.", categoria: "labiales", stock: 8, escalones: [[1, 10000], [3, 9000], [6, 8000]] },
  { referencia: "REF-105", nombre: "Brillo Labial Cristal", descripcion: "Efecto volumen con brillo intenso.", categoria: "labiales", stock: 3, escalones: [[1, 12000], [3, 10000]] },
  { referencia: "REF-233", nombre: "Rubor Durazno", descripcion: "Pigmentación suave y natural.", categoria: "rostro", stock: 15, escalones: [[1, 12000], [3, 11000], [6, 9500]] },
  { referencia: "REF-410", nombre: "Base Mate Natural", descripcion: "Cobertura alta, controla el brillo todo el día.", categoria: "rostro", stock: 5, escalones: [[1, 35000], [3, 32000]] },
  { referencia: "REF-415", nombre: "Polvo Compacto Traslúcido", descripcion: "Sella el maquillaje sin resecar.", categoria: "rostro", stock: 9, escalones: [[1, 22000], [3, 20000], [6, 18000]] },
  { referencia: "REF-520", nombre: "Paleta de Sombras Nude", descripcion: "12 tonos mate y satinados.", categoria: "ojos", stock: 6, escalones: [[1, 28000], [3, 25000]] },
  { referencia: "REF-525", nombre: "Máscara de Pestañas Volumen", descripcion: "Efecto pestañas postizas, a prueba de agua.", categoria: "ojos", stock: 20, escalones: [[1, 15000], [3, 13000], [6, 11000]] },
  { referencia: "REF-530", nombre: "Delineador Líquido Negro", descripcion: "Punta fina, trazo preciso.", categoria: "ojos", stock: 2, escalones: [[1, 14000], [3, 12000]] },
  { referencia: "REF-700", nombre: "Set de Brochas x5", descripcion: "Cerdas suaves, incluye estuche.", categoria: "accesorios", stock: 7, escalones: [[1, 30000], [3, 27000]] },
  { referencia: "REF-705", nombre: "Esponja Difuminadora", descripcion: "Para base y corrector, sin desperdicio.", categoria: "accesorios", stock: 25, escalones: [[1, 8000], [3, 7000], [6, 6000]] },
  { referencia: "REF-710", nombre: "Cosmetiquera Rosa", descripcion: "Impermeable, con compartimentos.", categoria: "accesorios", stock: 0, escalones: [[1, 25000]] },
];

const idCategoria = new Map();

for (const c of CATEGORIAS) {
  const { data, error } = await db
    .from("categories")
    .upsert(c, { onConflict: "slug" })
    .select("id")
    .single();
  if (error) throw error;
  idCategoria.set(c.slug, data.id);
}
console.log(`✓ ${CATEGORIAS.length} categorías`);

for (const p of PRODUCTOS) {
  const { data, error } = await db
    .from("products")
    .upsert(
      {
        referencia: p.referencia,
        nombre: p.nombre,
        descripcion: p.descripcion,
        category_id: idCategoria.get(p.categoria),
        stock: p.stock,
        activo: true,
      },
      { onConflict: "referencia" }
    )
    .select("id")
    .single();
  if (error) throw error;

  await db.from("price_tiers").delete().eq("product_id", data.id);
  const { error: e2 } = await db.from("price_tiers").insert(
    p.escalones.map(([min, precio]) => ({
      product_id: data.id,
      min_cantidad: min,
      precio_unitario: precio,
    }))
  );
  if (e2) throw e2;
}
console.log(`✓ ${PRODUCTOS.length} productos con sus escalones de precio`);
console.log("\n✅ Datos de ejemplo cargados");
