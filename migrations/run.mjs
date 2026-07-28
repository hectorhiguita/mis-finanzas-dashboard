// Runner de migraciones para el documento Firestore usuarios/{uid}.
//
// Se autentica con TU email/contraseña (los mismos del login de la app), por lo
// que respeta firestore.rules (auth.uid == uid) y no necesita service account.
//
// Uso:
//   FB_EMAIL=tu@correo FB_PASSWORD='tu-clave' npm run migrate:dry   # solo muestra
//   FB_EMAIL=tu@correo FB_PASSWORD='tu-clave' npm run migrate       # escribe (--apply)
//
// Antes de escribir, guarda un backup del documento actual en ./backups/.
//
// Este script también inicializa config/autorizados si no existe, usando el email
// autenticado. Eso es necesario para que las reglas de Firestore (lista blanca)
// permitan el acceso. Podés agregar más emails editando ese documento en la
// consola de Firebase o pasando FB_EMAILS_EXTRA="otro@email.com,mas@email.com".

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

import { firebaseConfig } from "../js/firebase-config.js";
import migrations from "./migrations.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");
const { FB_EMAIL, FB_PASSWORD, FB_EMAILS_EXTRA } = process.env;

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!FB_EMAIL || !FB_PASSWORD) {
  fail(
    "Faltan credenciales. Corré con:\n" +
      "  FB_EMAIL=tu@correo FB_PASSWORD='tu-clave' npm run migrate:dry\n" +
      "(usá tu email/contraseña del login de la app)."
  );
}

console.log(`\nProyecto Firebase: ${firebaseConfig.projectId}`);
console.log(`Modo: ${APPLY ? "APPLY (va a escribir en Firestore)" : "DRY-RUN (no escribe nada)"}\n`);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ── 1. Autenticación ──────────────────────────────────────────────────────────
let uid;
try {
  const cred = await signInWithEmailAndPassword(auth, FB_EMAIL, FB_PASSWORD);
  uid = cred.user.uid;
  console.log(`✔ Autenticado como ${FB_EMAIL} (uid ${uid})`);
} catch (e) {
  fail(`No se pudo iniciar sesión: ${e.code || e.message}`);
}

// ── 2. Bootstrap: crear config/autorizados si no existe ──────────────────────
// Las reglas de Firestore exigen que el email del usuario esté en este documento.
// Si no existe todavía (primera vez que se corre el script tras agregar la lista
// blanca), lo creamos acá con el email autenticado. Esto se hace ANTES de
// intentar leer usuarios/{uid}, porque si el documento no existe la regla falla.
const autorizadosRef = doc(db, "config", "autorizados");

let autorizadosSnap;
try {
  // La regla permite leer config/autorizados si el usuario está autenticado,
  // SIN exigir que ya esté en la lista. Así se puede hacer el bootstrap.
  autorizadosSnap = await getDoc(autorizadosRef);
} catch (e) {
  // Si falla la lectura de config/autorizados, las reglas viejas pueden estar
  // activas aún. Continuamos de todas formas e intentamos crear el documento.
  autorizadosSnap = null;
}

if (!autorizadosSnap || !autorizadosSnap.exists()) {
  // Construimos la lista inicial: el email actual + extras opcionales.
  const extras = FB_EMAILS_EXTRA
    ? FB_EMAILS_EXTRA.split(",").map((e) => e.trim()).filter(Boolean)
    : [];
  const emailsIniciales = [...new Set([FB_EMAIL.toLowerCase(), ...extras.map(e => e.toLowerCase())])];

  try {
    await setDoc(autorizadosRef, { emails: emailsIniciales });
    console.log(`✔ config/autorizados creado con: ${emailsIniciales.join(", ")}`);
  } catch (e) {
    fail(
      `No se pudo crear config/autorizados: ${e.code || e.message}\n` +
      `  Crealo manualmente en la consola de Firebase:\n` +
      `  Colección: config  Documento: autorizados  Campo: emails (array) = ["${FB_EMAIL}"]\n` +
      `  Luego volvé a correr este script.`
    );
  }
} else {
  const emails = autorizadosSnap.data().emails || [];
  console.log(`✔ config/autorizados existe con ${emails.length} email(s): ${emails.join(", ")}`);

  // Si el email actual no está en la lista, lo agregamos para no bloquearse.
  if (!emails.map(e => e.toLowerCase()).includes(FB_EMAIL.toLowerCase())) {
    const actualizados = [...emails, FB_EMAIL.toLowerCase()];
    try {
      await setDoc(autorizadosRef, { emails: actualizados });
      console.log(`  → ${FB_EMAIL} agregado a la lista de autorizados.`);
    } catch (e) {
      fail(`No se pudo actualizar config/autorizados: ${e.code || e.message}`);
    }
  }
}

// ── 3. Leer documento del usuario ────────────────────────────────────────────
const ref = doc(db, "usuarios", uid);
const snap = await getDoc(ref);
if (!snap.exists()) {
  fail(`El documento usuarios/${uid} no existe todavía. Abrí la app una vez para crearlo.`);
}

const original = snap.data();
// Copia profunda sobre la que aplicamos las migraciones.
const migrated = JSON.parse(JSON.stringify(original));

// ── 4. Aplicar migraciones ────────────────────────────────────────────────────
console.log(`\nAplicando ${migrations.length} migración(es):\n`);
let anyChange = false;
for (const m of migrations) {
  let result;
  try {
    result = m.apply(migrated);
  } catch (e) {
    fail(`Migración ${m.id} falló: ${e.stack || e.message}`);
  }
  const mark = result.changed ? "●" : "○";
  console.log(`  ${mark} ${m.id}: ${result.note}`);
  anyChange = anyChange || result.changed;
}

if (!anyChange) {
  console.log("\n✔ Nada que migrar: el documento ya está al día.\n");
  process.exit(0);
}

// Diff textual sencillo (solo las claves de primer nivel que cambiaron).
console.log("\nCambios detectados en:");
for (const key of Object.keys(migrated)) {
  if (JSON.stringify(original[key]) !== JSON.stringify(migrated[key])) {
    console.log(`  - ${key}`);
  }
}

if (!APPLY) {
  console.log(
    "\nDRY-RUN: no se escribió nada. Revisá los cambios y, si estás de acuerdo,\n" +
      "corré de nuevo con `npm run migrate` (agrega --apply).\n"
  );
  process.exit(0);
}

// ── 5. APPLY: backup + escritura ─────────────────────────────────────────────
const backupsDir = join(__dirname, "backups");
mkdirSync(backupsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = join(backupsDir, `usuarios-${uid}-${stamp}.json`);
writeFileSync(backupFile, JSON.stringify(original, null, 2));
console.log(`\n✔ Backup del documento original: ${backupFile}`);

try {
  await setDoc(ref, migrated); // mismo comportamiento que guardarDatos(): sobrescribe todo
  console.log("✔ Documento actualizado en Firestore.\n");
} catch (e) {
  fail(`Error escribiendo en Firestore: ${e.code || e.message}. El backup quedó guardado.`);
}

process.exit(0);
