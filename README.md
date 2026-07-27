# Presupuesto sin culpa

Aplicación personal de presupuesto: resumen mensual, semáforo semanal de gastos variables, lista de mercado con detalle de ítems, seguimiento de deudas y ajustes. Guarda todo en **Firestore** (Firebase) y protege el acceso con **Firebase Authentication** (correo + contraseña), así que tus datos viven en tu propia base de datos, no en el navegador.

No necesitas build ni frameworks: es HTML + CSS + JavaScript vanilla, con el SDK de Firebase importado directamente desde su CDN.

---

## Estructura del repo

```
presupuesto-hector/
├── index.html                     # estructura de la app y las 5 pestañas
├── css/
│   └── style.css                  # todos los estilos
├── js/
│   ├── firebase-config.example.js # plantilla de config (se copia, no se edita)
│   ├── firebase-config.js         # config real (aquí SÍ versionada, ver nota)
│   ├── firebase.js                # inicializa Firebase App / Auth / Firestore
│   ├── store.js                   # datos iniciales + lectura/escritura en Firestore
│   └── app.js                     # toda la lógica de la interfaz
├── firestore.rules                # reglas de seguridad (quién puede leer/escribir qué)
├── firebase.json                  # config para Firebase CLI (reglas + hosting opcional)
├── .firebaserc.example             # plantilla para vincular tu proyecto con la CLI
└── .gitignore
```

---

## 1. Crear el proyecto de Firebase

1. Entra a [console.firebase.google.com](https://console.firebase.google.com) con tu cuenta de Google y crea un proyecto nuevo (puedes desactivar Google Analytics, no lo necesitas).
2. Dentro del proyecto, ve a **Compilación > Authentication > Comenzar** y habilita el proveedor **Correo electrónico/contraseña**.
3. Ve a **Compilación > Firestore Database > Crear base de datos**. Elige una región cercana (`us-central` o `southamerica-east1` funcionan bien desde Colombia) y arranca en **modo de producción** (no en modo de prueba: el modo de prueba deja la base de datos abierta a cualquiera durante 30 días, y aquí hay información financiera real).
4. Ve a **Configuración del proyecto** (ícono de engranaje, arriba a la izquierda) > pestaña **General** > sección "Tus apps" > clic en **`</>`** (Web) para registrar una app web. No necesitas Firebase Hosting en este paso, solo el objeto de configuración.
5. Copia el objeto `firebaseConfig` que te muestra (apiKey, authDomain, projectId, etc.).

## 2. Configurar el proyecto localmente

1. Clona este repo.
2. Copia `js/firebase-config.example.js` a `js/firebase-config.js` y pega ahí los valores reales que copiaste en el paso anterior.
3. **En este repo** `js/firebase-config.js` viene ya lleno con la config real del proyecto `caceria-deudas` y **sí está versionado**, porque el sitio se publica por GitHub Pages (que sirve los archivos del repo tal cual). Por eso se sacó del `.gitignore`. (Nota honesta: el `apiKey` de una app **web** de Firebase no es secreto por diseño — está pensado para viajar en el navegador de tus usuarios — la seguridad real la dan las reglas de Firestore del paso siguiente. Aun así, tratándose de tus finanzas personales, mantén este repositorio **privado**.)

## 3. Desplegar las reglas de seguridad (paso crítico)

Sin este paso, dependiendo de cómo configuraste Firestore, tu base de datos puede quedar sin restricciones reales de acceso. El archivo `firestore.rules` ya incluido dice: *"solo el dueño autenticado de un documento puede leerlo o escribirlo"*.

Con [Firebase CLI](https://firebase.google.com/docs/cli) instalada (`npm install -g firebase-tools`):

```bash
firebase login
cp .firebaserc.example .firebaserc   # y edita el projectId adentro
firebase deploy --only firestore:rules
```

Si prefieres no instalar la CLI, puedes pegar el contenido de `firestore.rules` manualmente en **Firestore Database > Reglas** dentro de la consola de Firebase y publicar desde ahí.

## 4. Correr la app localmente

Como `index.html` carga módulos de JavaScript (`type="module"`), no puedes abrirlo con doble clic (`file://`) — los navegadores bloquean módulos ES en ese esquema. Sirve la carpeta con cualquier servidor estático simple:

```bash
npx serve .
# o
python3 -m http.server 8080
```

Y abre la URL que te indique (por ejemplo `http://localhost:8080`).

## 5. Publicarla (opcional)

**Opción A — Firebase Hosting** (recomendada, ya está configurado en `firebase.json`):
```bash
firebase deploy --only hosting
```

**Opción B — GitHub Pages** (es la que usa este sitio): activa Pages en la configuración del repo apuntando a la rama `master`. `js/firebase-config.js` ya está versionado a propósito (ver paso 2), así que no hay nada extra que hacer: Pages sirve directamente los archivos del repo.

---

## Cómo usarla

1. Abre la app, elige **"¿Primera vez? Crea tu cuenta"**, pon tu correo y una contraseña (mínimo 6 caracteres).
2. Al crear la cuenta, la app carga automáticamente el presupuesto base (ingreso, deudas, categorías y lista de mercado) y lo guarda en tu documento de Firestore (`usuarios/{tu-uid}`).
3. Desde ahí, todo lo que edites (gastos, checklist semanal, ítems de mercado, saldos de deuda, ajustes) se guarda en Firestore en tiempo real.
4. Si entras desde otro dispositivo con el mismo correo y contraseña, vas a ver exactamente los mismos datos — ya no dependen del navegador ni del dispositivo.

## Estructura de datos en Firestore

Todo vive en un solo documento por usuario:

```
usuarios/{uid}
├── ingreso           (número)
├── categorias        (arreglo: fijas y variables, con sus límites)
├── deudas            (arreglo: nombre, cuota, saldo)
├── gastos            (arreglo: cada gasto registrado en "Semana")
├── pagosMes          (mapa: {"2026-08": {idDeuda: true, ...}})
├── checklist         (mapa: {"2026-07-27": {n1: true, ...}})
├── mercadoItems       (arreglo: lista de mercado con detalle)
└── comprasMercado     (mapa: {"2026-08": {idItem: true, ...}})
```

Es un único documento (no subcolecciones) a propósito: para uso personal está muy lejos del límite de 1 MB por documento de Firestore, y simplifica leer/guardar todo de una vez.

## Seguridad y privacidad — notas honestas

- La contraseña la valida Firebase Authentication, no este código — nunca se guarda en texto plano en ningún lado que tú controles.
- Las reglas de `firestore.rules` son la verdadera barrera: sin ellas desplegadas, cualquiera con tu `projectId` podría potencialmente leer o escribir datos si el modo de la base quedó abierto. Verifica esto en la consola de Firebase antes de darle uso real.
- Este repo no incluye borrado de la cuenta de Authentication en sí (solo borra los datos del presupuesto). Si algún día quieres eliminar la cuenta por completo, hazlo desde **Authentication > Users** en la consola de Firebase.
- Considera mantener este repositorio como **privado** en GitHub, dado que contiene la estructura completa de tus finanzas personales aunque no contenga cifras reales en el código.
- Firestore tiene una capa gratuita generosa (Spark plan) que alcanza de sobra para uso personal de una sola persona.

## Próximas mejoras posibles

- Exportar/backup periódico de tus datos (Firestore permite exportar colecciones completas).
- Notificaciones o recordatorios (por ejemplo, con Firebase Cloud Messaging) para el ritual semanal del domingo.
- Historial mensual de "disponible" para ver la tendencia a lo largo del año.
