// Script de una sola vez: crea o actualiza config/autorizados en Firestore
// con la lista blanca de emails permitidos para usar la app.
//
// Uso:
//   FB_EMAIL=hahiguit@gmail.com FB_PASSWORD='tu-clave' node setup-autorizados.mjs

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

import { firebaseConfig } from "../js/firebase-config.js";

const { FB_EMAIL, FB_PASSWORD } = process.env;

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!FB_EMAIL || !FB_PASSWORD) {
  fail("Corré con: FB_EMAIL=hahiguit@gmail.com FB_PASSWORD='tu-clave' node setup-autorizados.mjs");
}

const EMAILS_AUTORIZADOS = [
  "hahiguit@gmail.com",
  "maritzamedina13@gmail.com"
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`\nProyecto Firebase: ${firebaseConfig.projectId}`);
console.log(`Emails autorizados: ${EMAILS_AUTORIZADOS.join(", ")}\n`);

try {
  const cred = await signInWithEmailAndPassword(auth, FB_EMAIL, FB_PASSWORD);
  console.log(`✔ Autenticado como ${cred.user.email}`);
} catch (e) {
  fail(`No se pudo iniciar sesión: ${e.code || e.message}`);
}

try {
  await setDoc(doc(db, "config", "autorizados"), {
    emails: EMAILS_AUTORIZADOS
  });
  console.log("✔ config/autorizados actualizado en Firestore.");
  console.log("\nAhora podés publicar las reglas de Firestore con:");
  console.log("  firebase deploy --only firestore:rules\n");
} catch (e) {
  fail(`No se pudo escribir config/autorizados: ${e.code || e.message}`);
}

process.exit(0);
