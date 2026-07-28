# Migraciones del presupuesto (Firestore)

Scripts para actualizar el documento `usuarios/{uid}` de Firestore **sin tener
que editar cada cosa a mano en la interfaz**. Útil cuando cambian valores del
presupuesto (semilla en `js/store.js`) y querés reflejarlos en tu documento ya
existente, que la app nunca sobreescribe con los defaults nuevos.

## Cómo funciona

- Se autentica con **tu email/contraseña** (los mismos del login de la app), así
  que respeta `firestore.rules` (`auth.uid == uid`). **No usa service account.**
- Reusa `../js/firebase-config.js` (config pública de la app web).
- Corre todas las migraciones de `migrations.mjs` en orden. Cada una es
  **idempotente**: volver a correrlas sobre datos ya migrados no cambia nada.
- **Dry-run por defecto**: muestra qué cambiaría sin escribir. Con `--apply`
  escribe, y antes guarda un **backup** del documento original en `./backups/`.

## Uso

```bash
cd migrations
npm install            # una sola vez (instala firebase)

# 1) Ver qué cambiaría, sin tocar nada:
FB_EMAIL=tu@correo FB_PASSWORD='tu-clave' npm run migrate:dry

# 2) Aplicar de verdad (hace backup y escribe):
FB_EMAIL=tu@correo FB_PASSWORD='tu-clave' npm run migrate
```

> Pasá las credenciales por variables de entorno (o el gestor de secretos del
> pipeline). No las escribas en ningún archivo versionado.

### Opción B: manual desde GitHub Actions

Workflow `.github/workflows/migrate.yml` (dispara `workflow_dispatch`). En la
pestaña **Actions** del repo → **Migrar presupuesto (Firestore)** → **Run
workflow**, elegí `modo`:

- `dry` (por defecto): solo muestra el diff en los logs, no escribe.
- `apply`: hace backup y escribe. El backup se sube como **artifact**
  (`backup-firestore`, 30 días).

Requiere dos **secrets** del repo (Settings → Secrets and variables → Actions):
`FB_EMAIL` y `FB_PASSWORD`. El repo debe ser **privado**.

## Agregar una migración nueva

Editá `migrations.mjs` y agregá un objeto al final de la lista:

```js
{
  id: "002-lo-que-sea",
  describe: "Qué hace y por qué.",
  apply(data) {
    // Modificá `data` IN PLACE. Debe ser idempotente.
    // Devolvé { changed: boolean, note: string }.
    return { changed: false, note: "..." };
  },
}
```

No borres ni edites migraciones ya aplicadas: agregá una nueva encima.

## Migraciones incluidas

- **001-mascotas-reales** — Sobre de mascotas con datos reales de PriceSmart:
  cuido perros $285.600 (bulto ~20 días), comida gato $56.095, snack gatos
  $61.857 (~2 meses prorrateado) y colchón veterinario $10.000. Reemplaza el
  ítem genérico "Alimento perros $300.000".
- **002-hogar-maritza** — Convierte el presupuesto en un hogar de dos personas.
  Migra el `ingreso` viejo a Héctor y agrega a Maritza (neto $4.419.560 =
  $5.000.000 − seguridad social de contratista). Marca dueño en categorías
  (arriendo y mercado = `compartido`, resto = `hector`), agrega la maestría
  $700.000/mes de Maritza y sus deudas (Banco de Bogotá, ICETEX con pago total
  a cuota $0, y Sistecrédito Ostu/Koaj/Lafam). Los compartidos se dividen
  proporcional al ingreso (Héctor 76%, Maritza 24%).
- **003-apoyo-mama-maritza** — Agrega el apoyo mensual de $200.000 que Maritza
  le da a su mamá (gasto fijo, 100% de ella).
- **004-nombre-alejo** — Renombra la persona `hector` de "Héctor" a "Alejo"
  (solo el nombre visible; el id `hector` se mantiene como llave de datos).
