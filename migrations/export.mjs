// Exporta tu documento Firestore usuarios/{uid} a un archivo JSON local, para
// poder revisarlo/analizarlo fuera de la app (por ejemplo, para que Claude te
// sugiera ahorros sobre tus gastos reales). SOLO LEE: nunca escribe en Firestore.
//
// Se autentica con TU email/contraseña (los mismos del login de la app), igual
// que run.mjs, así que respeta firestore.rules (auth.uid == uid). No usa service
// account.
//
// Uso:
//   FB_EMAIL=tu@correo FB_PASSWORD='tu-clave' npm run export
//
// El JSON se guarda en ./snapshots/ (gitignored: contiene datos financieros
// personales). Se escriben dos archivos: latest.json (siempre el más reciente)
// y uno con fecha, para tener historial de snapshots.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

import { firebaseConfig } from "../js/firebase-config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { FB_EMAIL, FB_PASSWORD } = process.env;

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!FB_EMAIL || !FB_PASSWORD) {
  fail(
    "Faltan credenciales. Corré con:\n" +
      "  FB_EMAIL=tu@correo FB_PASSWORD='tu-clave' npm run export\n" +
      "(usá tu email/contraseña del login de la app)."
  );
}

console.log(`\nProyecto Firebase: ${firebaseConfig.projectId}`);
console.log(`Modo: EXPORT (solo lectura, no escribe en Firestore)\n`);

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

const datos = snap.data();

const dir = join(__dirname, "snapshots");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const conFecha = join(dir, `usuarios-${stamp}.json`);
const latest = join(dir, "latest.json");
const payload = JSON.stringify(datos, null, 2);
writeFileSync(conFecha, payload);
writeFileSync(latest, payload);

// Resumen rápido en consola para confirmar que salió lo esperado.
const nGastos = Array.isArray(datos.gastos) ? datos.gastos.length : 0;
const nDeudas = Array.isArray(datos.deudas) ? datos.deudas.length : 0;
const nCats = Array.isArray(datos.categorias) ? datos.categorias.length : 0;
console.log(`✔ Snapshot guardado:`);
console.log(`   ${latest}`);
console.log(`   ${conFecha}`);
console.log(`   (${nCats} categorías, ${nDeudas} deudas, ${nGastos} gastos registrados)\n`);
console.log("Cuando quieras que revise tus gastos, avísame y leo snapshots/latest.json.\n");

process.exit(0);
