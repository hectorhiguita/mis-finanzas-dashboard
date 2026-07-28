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

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

import { firebaseConfig } from "../js/firebase-config.js";
import migrations from "./migrations.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");
const { FB_EMAIL, FB_PASSWORD } = process.env;

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

let uid;
try {
  const cred = await signInWithEmailAndPassword(auth, FB_EMAIL, FB_PASSWORD);
  uid = cred.user.uid;
  console.log(`✔ Autenticado como ${FB_EMAIL} (uid ${uid})`);
} catch (e) {
  fail(`No se pudo iniciar sesión: ${e.code || e.message}`);
}

const ref = doc(db, "usuarios", uid);
const snap = await getDoc(ref);
if (!snap.exists()) {
  fail(`El documento usuarios/${uid} no existe todavía. Abrí la app una vez para crearlo.`);
}

const original = snap.data();
// Copia profunda sobre la que aplicamos las migraciones.
const migrated = JSON.parse(JSON.stringify(original));

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

// APPLY: backup + escritura.
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
