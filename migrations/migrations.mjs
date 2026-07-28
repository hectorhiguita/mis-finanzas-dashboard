// Lista ordenada de migraciones del documento Firestore usuarios/{uid}.
//
// Cada migración es idempotente: recibe el objeto de datos completo (el mismo
// que la app guarda con setDoc), lo modifica IN PLACE si hace falta, y devuelve
// { changed: boolean, note: string }. Volver a correr todas las migraciones
// sobre datos ya migrados no debe cambiar nada (changed:false).
//
// Para una edición nueva del presupuesto: agrega un objeto más al final de la
// lista. No borres ni edites las migraciones viejas ya aplicadas.

const migrations = [
  {
    id: "001-mascotas-reales",
    describe:
      "Sobre de mascotas con datos reales de PriceSmart: cuido perros $285.600 " +
      "(bulto ~20 días), comida gato $56.095, snack gatos $61.857 (~2 meses " +
      "prorrateado) y colchón veterinario $10.000. Total ~$413.552/mes.",
    apply(data) {
      if (!Array.isArray(data.mercadoItems)) {
        return { changed: false, note: "el documento no tiene mercadoItems" };
      }
      const notes = [];
      const byId = (id) => data.mercadoItems.find((i) => i.id === id);

      // Ítems canónicos del subgrupo "perros" (incluye gatos y veterinario).
      const canon = [
        { id: "m19", grupo: "perros", cat: "Perros", nombre: "Cuido perros (PriceSmart 20480)", cantidad: "bulto ~20 días", costo: 285600 },
        { id: "m20", grupo: "perros", cat: "Gatos", nombre: "Comida gato", cantidad: "mes", costo: 56095 },
        { id: "m21", grupo: "perros", cat: "Gatos", nombre: "Snack gatos", cantidad: "bulto ~2 meses (prorrateado)", costo: 61857 },
        { id: "m22", grupo: "perros", cat: "Veterinario", nombre: "Veterinario / imprevistos", cantidad: "mes", costo: 10000 },
      ];

      for (const item of canon) {
        const actual = byId(item.id);
        if (!actual) {
          data.mercadoItems.push({ ...item });
          notes.push(`+${item.id} ${item.nombre}`);
        } else if (JSON.stringify(actual) !== JSON.stringify(item)) {
          Object.assign(actual, item); // mantiene la posición en el arreglo
          notes.push(`~${item.id} ${item.nombre}`);
        }
      }

      return { changed: notes.length > 0, note: notes.join("; ") || "ya estaba al día" };
    },
  },

  {
    id: "002-hogar-maritza",
    describe:
      "Modelo de hogar por persona. Agrega a Maritza (ingreso neto $4.419.560 = " +
      "$5.000.000 − seguridad social), marca dueño en categorías y deudas " +
      "(arriendo y mercado = compartido, resto de lo existente = héctor), agrega " +
      "la maestría $700.000/mes (de Maritza) y sus deudas: Banco de Bogotá " +
      "$196.198, ICETEX (pago total, cuota $0) y Sistecrédito Ostu/Koaj/Lafam.",
    apply(data) {
      const notes = [];

      // 1. personas (dos ingresos). Migra el `ingreso` viejo a Héctor.
      if (!Array.isArray(data.personas)) {
        const ingresoHector = typeof data.ingreso === "number" ? data.ingreso : 14050000;
        data.personas = [
          { id: "hector", nombre: "Héctor", ingreso: ingresoHector },
          { id: "maritza", nombre: "Maritza", ingreso: 4419560 },
        ];
        delete data.ingreso;
        notes.push("+personas (héctor+maritza)");
      }

      // 2. dueño en categorías + maestría de Maritza.
      if (Array.isArray(data.categorias)) {
        const compartidas = new Set(["arriendo", "mercado"]);
        for (const c of data.categorias) {
          // Solo asignar cuando falta el dueño: así no se pisa a maestría
          // (maritza) ni ningún dueño puesto a mano. Idempotente.
          if (!c.dueno) {
            c.dueno = compartidas.has(c.id) ? "compartido" : "hector";
            notes.push(`dueño ${c.id}=${c.dueno}`);
          }
        }
        if (!data.categorias.find((c) => c.id === "maestria")) {
          data.categorias.push({ id: "maestria", nombre: "Maestría (Maritza)", limite: 700000, tipo: "fijo", dueno: "maritza" });
          notes.push("+cat maestria");
        }
      }

      // 3. dueño en deudas existentes + deudas de Maritza.
      if (Array.isArray(data.deudas)) {
        for (const d of data.deudas) {
          if (!d.dueno) {
            d.dueno = "hector";
            notes.push(`dueño deuda ${d.id}=hector`);
          }
        }
        const nuevas = [
          { id: "mar_bdo", nombre: "Banco de Bogotá · libranza (Maritza)", cuota: 196198, saldo: 3197739, dueno: "maritza" },
          { id: "mar_icetex", nombre: "ICETEX (Maritza) · pago total este mes", cuota: 0, saldo: 652000, dueno: "maritza" },
          { id: "mar_ostu", nombre: "Sistecrédito · Ostu (3/4) (Maritza)", cuota: 65785, saldo: 65785, dueno: "maritza" },
          { id: "mar_koaj", nombre: "Sistecrédito · Koaj la central (1/4) (Maritza)", cuota: 120427, saldo: 361281, dueno: "maritza" },
          { id: "mar_lafam", nombre: "Sistecrédito · Lafam (4/6) (Maritza)", cuota: 421906, saldo: 843812, dueno: "maritza" },
        ];
        for (const nd of nuevas) {
          if (!data.deudas.find((d) => d.id === nd.id)) {
            data.deudas.push({ ...nd });
            notes.push(`+deuda ${nd.id}`);
          }
        }
      }

      return { changed: notes.length > 0, note: notes.join("; ") || "ya estaba al día" };
    },
  },

  {
    id: "003-apoyo-mama-maritza",
    describe:
      "Agrega el apoyo mensual de $200.000 que Maritza le da a su mamá " +
      "(gasto fijo, 100% de ella).",
    apply(data) {
      if (!Array.isArray(data.categorias)) {
        return { changed: false, note: "el documento no tiene categorias" };
      }
      if (data.categorias.find((c) => c.id === "mar_mama")) {
        return { changed: false, note: "ya existe mar_mama" };
      }
      data.categorias.push({ id: "mar_mama", nombre: "Apoyo mamá (Maritza)", limite: 200000, tipo: "fijo", dueno: "maritza" });
      return { changed: true, note: "+cat mar_mama (apoyo mamá Maritza $200.000)" };
    },
  },

  {
    id: "004-nombre-alejo",
    describe:
      "Renombra a la persona 'hector' de 'Héctor' a 'Alejo' (solo el nombre " +
      "visible; el id 'hector' se mantiene como llave de datos).",
    apply(data) {
      if (!Array.isArray(data.personas)) {
        return { changed: false, note: "el documento no tiene personas" };
      }
      const p = data.personas.find((x) => x.id === "hector");
      if (!p) return { changed: false, note: "no existe la persona hector" };
      if (p.nombre === "Alejo") return { changed: false, note: "ya es Alejo" };
      p.nombre = "Alejo";
      return { changed: true, note: "persona hector: nombre → Alejo" };
    },
  },

  {
    id: "005-aseo-higiene",
    describe:
      "Pre-carga categorías de Aseo e Higiene personal en la lista de mercado " +
      "con precios reales de PriceSmart (facturas may–jun 2026).",
    apply(data) {
      if (!Array.isArray(data.mercadoItems)) {
        return { changed: false, note: "el documento no tiene mercadoItems" };
      }
      const nuevos = [
        { id: "m23", grupo: "humano", cat: "Aseo", nombre: "Papel higiénico", cantidad: "mes", costo: 54538 },
        { id: "m24", grupo: "humano", cat: "Aseo", nombre: "Detergente de ropa (Fab)", cantidad: "mes", costo: 58739 },
        { id: "m25", grupo: "humano", cat: "Aseo", nombre: "Jabón de manos", cantidad: "mes", costo: 45294 },
        { id: "m26", grupo: "humano", cat: "Higiene personal", nombre: "Shampoo", cantidad: "mes", costo: 37731 },
        { id: "m27", grupo: "humano", cat: "Higiene personal", nombre: "Jabón corporal (Protex)", cantidad: "mes", costo: 27311 },
        { id: "m28", grupo: "humano", cat: "Higiene personal", nombre: "Gel de baño", cantidad: "mes", costo: 39412 },
        { id: "m29", grupo: "humano", cat: "Higiene personal", nombre: "Crema corporal (Eucerin)", cantidad: "$128.487 ~cada 2.5 meses (prorrateado)", costo: 51395 },
      ];
      const notes = [];
      for (const it of nuevos) {
        if (!data.mercadoItems.find((x) => x.id === it.id)) {
          data.mercadoItems.push({ ...it });
          notes.push(`+${it.id} ${it.nombre}`);
        }
      }
      // Subir el sobre de mercado a $1.75M para cubrir aseo+higiene, solo si
      // sigue en el valor viejo por defecto (no pisa un ajuste manual).
      const merc = Array.isArray(data.categorias) && data.categorias.find((c) => c.id === "mercado");
      if (merc && merc.limite === 1500000) {
        merc.limite = 1750000;
        merc.semanal = 437500;
        notes.push("mercado límite → $1.750.000");
      }
      return { changed: notes.length > 0, note: notes.join("; ") || "ya estaba al día" };
    },
  },
];

export default migrations;
