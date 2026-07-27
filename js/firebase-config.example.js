// 1. Copia este archivo y renómbralo a "firebase-config.js" (en la misma carpeta js/).
// 2. Reemplaza los valores de abajo con los de TU proyecto de Firebase:
//    Firebase Console > Configuración del proyecto (ícono de engranaje) >
//    "Tus apps" > selecciona la app web > "Configuración del SDK".
// 3. "firebase-config.js" ya está en .gitignore, así que no se sube al repo.
//    (Los valores de config de Firebase para apps web no son secretos en sí mismos
//    -la seguridad real la dan las reglas de Firestore y Authentication- pero como
//    aquí vive información financiera personal, es buena práctica mantener el repo
//    y esta configuración fuera de la vista pública si tu repositorio es público.)

export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};
