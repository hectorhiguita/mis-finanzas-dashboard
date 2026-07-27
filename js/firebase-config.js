// Config real del proyecto Firebase "caceria-deudas" (el mismo que ya usabas).
// El apiKey de una app web de Firebase NO es secreto: viaja en el navegador de
// cualquier usuario por diseño. La seguridad real la dan las reglas de Firestore
// (firestore.rules) + Firebase Authentication. Aun así, mantén este repo PRIVADO.
//
// Este sitio se publica por GitHub Pages, que sirve directamente los archivos del
// repo, así que este firebase-config.js SÍ debe estar versionado (por eso se sacó
// de .gitignore). Ver README, sección "5. Publicarla > Opción B — GitHub Pages".
export const firebaseConfig = {
  apiKey: "AIzaSyCPeFkm_-llfyN32nsZdQyfKspESwyNG7I",
  authDomain: "caceria-deudas.firebaseapp.com",
  projectId: "caceria-deudas",
  storageBucket: "caceria-deudas.firebasestorage.app",
  messagingSenderId: "422968886595",
  appId: "1:422968886595:web:46c7dc31745bcd02399bf6"
};
