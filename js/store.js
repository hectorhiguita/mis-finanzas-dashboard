// Capa de datos: qué guardamos y cómo se lee/escribe en Firestore.
// Cada usuario autenticado tiene UN documento en la colección "usuarios",
// con su UID como ID de documento. Todo el estado del presupuesto vive
// ahí adentro como un solo objeto (ingreso, categorías, deudas, gastos,
// checklist semanal, lista de mercado, etc.), igual que antes vivía en
// una sola clave de almacenamiento local.
import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/* ================= datos iniciales (tu realidad, Alejo) ================= */
export function datosIniciales(){
  return {
    // Hogar de dos personas. Los gastos con dueno:'compartido' se dividen
    // proporcional al ingreso neto de cada quien (ver app.js: proporcion()).
    personas: [
      {id:'hector', nombre:'Alejo', ingreso:14050000},
      {id:'maritza', nombre:'Maritza', ingreso:4419560} // neto: $5.000.000 − seguridad social ($580.440) por contrato de prestación de servicios en el ITM
    ],
    categorias: [
      // fijas (no se registran gastos, solo informan)
      {id:'arriendo', nombre:'Arriendo', limite:1550000, tipo:'fijo', dueno:'compartido'},
      {id:'epm1', nombre:'EPM casa', limite:210000, tipo:'fijo', dueno:'hector'},
      {id:'epm2', nombre:'EPM mamá', limite:200000, tipo:'fijo', dueno:'hector'},
      {id:'agua', nombre:'Agua', limite:75000, tipo:'fijo', dueno:'hector'},
      {id:'gaspipeta', nombre:'Gas pipeta', limite:200000, tipo:'fijo', dueno:'hector'},
      {id:'maestria', nombre:'Maestría (Maritza)', limite:700000, tipo:'fijo', dueno:'maritza'},
      {id:'mar_mama', nombre:'Apoyo mamá (Maritza)', limite:200000, tipo:'fijo', dueno:'maritza'},
      // variables (semáforo)
      {id:'mercado', nombre:'Mercado', limite:1500000, tipo:'variable', semanal:375000, dueno:'compartido'},
      {id:'gasolina', nombre:'Gasolina', limite:720000, tipo:'variable', semanal:170000, dueno:'hector'},
      {id:'ocio', nombre:'Ocio sin culpa', limite:300000, tipo:'variable', semanal:75000, dueno:'hector'},
      {id:'colchon', nombre:'Colchón / emergencias', limite:100000, tipo:'fijo', dueno:'hector'}
    ],
    deudas: [
      {id:'bbva', nombre:'Préstamo BBVA (carro)', cuota:2873305, saldo:119956722, dueno:'hector'},
      {id:'bbvavisa', nombre:'Visa Infinite BBVA (mín.)', cuota:1693238, saldo:25444025, dueno:'hector'},
      {id:'occid', nombre:'Préstamo B. Occidente (moto)', cuota:1891570, saldo:66185003, dueno:'hector'},
      {id:'visa', nombre:'Visa Occidente (mín. alterno)', cuota:1353000, saldo:27588554, dueno:'hector'},
      {id:'davi', nombre:'Davibank', cuota:1204578, saldo:1204578, dueno:'hector'},
      {id:'nu', nombre:'Nu', cuota:317590, saldo:2907007, dueno:'hector'},
      {id:'siste1', nombre:'Sistecrédito · Garmin (2/6)', cuota:575384, saldo:2567837, dueno:'hector'},
      {id:'siste2', nombre:'Sistecrédito · Luegopago SOAT (2/4)', cuota:240348, saldo:650164, dueno:'hector'},
      {id:'siste3', nombre:'Sistecrédito · KOAJ (1/2)', cuota:144214, saldo:250700, dueno:'hector'},
      {id:'addi', nombre:'Addi', cuota:312165, saldo:874265, dueno:'hector'},
      {id:'bancol', nombre:'Bancolombia libre inversión (nómina)', cuota:2846006, saldo:0, nomina:true, dueno:'hector'},
      // Deudas de Maritza
      {id:'mar_bdo', nombre:'Banco de Bogotá · libranza (Maritza)', cuota:196198, saldo:3197739, dueno:'maritza'},
      {id:'mar_icetex', nombre:'ICETEX (Maritza) · pago total este mes', cuota:0, saldo:652000, dueno:'maritza'},
      {id:'mar_ostu', nombre:'Sistecrédito · Ostu (3/4) (Maritza)', cuota:65785, saldo:65785, dueno:'maritza'},
      {id:'mar_koaj', nombre:'Sistecrédito · Koaj la central (1/4) (Maritza)', cuota:120427, saldo:361281, dueno:'maritza'},
      {id:'mar_lafam', nombre:'Sistecrédito · Lafam (4/6) (Maritza)', cuota:421906, saldo:843812, dueno:'maritza'}
    ],
    gastos: [],           // {id, fecha, cat, monto, nota}
    pagosMes: {},         // {'2026-07': {bbva:true,...}}  deudas pagadas del mes
    pagosCasa: {},        // {'2026-07': {arriendo:{pagado:true, hector:1179097, maritza:370903}, ...}}  aportes individuales a compartidos
    checklist: {},        // {'2026-07-27': {n1:true,...}}
    mercadoItems: [
      // Proteínas
      {id:'m1', grupo:'humano', cat:'Proteínas', nombre:'Pechuga de pollo', cantidad:'8 kg', costo:128000},
      {id:'m2', grupo:'humano', cat:'Proteínas', nombre:'Carne molida de res', cantidad:'6 kg', costo:120000},
      {id:'m3', grupo:'humano', cat:'Proteínas', nombre:'Huevos', cantidad:'4 cubetas x30', costo:68000},
      {id:'m4', grupo:'humano', cat:'Proteínas', nombre:'Atún en lata', cantidad:'16 latas', costo:104000},
      {id:'m5', grupo:'humano', cat:'Proteínas', nombre:'Pescado (tilapia/bagre)', cantidad:'4 kg', costo:60000},
      {id:'m6', grupo:'humano', cat:'Proteínas', nombre:'Queso campesino', cantidad:'3 kg', costo:45000},
      {id:'m7', grupo:'humano', cat:'Proteínas', nombre:'Leche para nódulos de kéfir', cantidad:'12 litros', costo:54000},
      {id:'m8', grupo:'humano', cat:'Proteínas', nombre:'Lentejas, fríjoles, garbanzo', cantidad:'10 lb', costo:38000},
      // Carbohidratos
      {id:'m9', grupo:'humano', cat:'Carbohidratos', nombre:'Arroz', cantidad:'6 kg', costo:23000},
      {id:'m10', grupo:'humano', cat:'Carbohidratos', nombre:'Papa', cantidad:'10 kg', costo:25000},
      {id:'m11', grupo:'humano', cat:'Carbohidratos', nombre:'Plátano', cantidad:'5 kg', costo:10000},
      {id:'m12', grupo:'humano', cat:'Carbohidratos', nombre:'Avena', cantidad:'2 kg', costo:12000},
      {id:'m13', grupo:'humano', cat:'Carbohidratos', nombre:'Pan integral / arepas', cantidad:'mes', costo:30000},
      // Frutas y verduras
      {id:'m14', grupo:'humano', cat:'Frutas y verduras', nombre:'Verduras variadas', cantidad:'mes', costo:120000},
      {id:'m15', grupo:'humano', cat:'Frutas y verduras', nombre:'Frutas variadas', cantidad:'mes', costo:100000},
      // Grasas y otros
      {id:'m16', grupo:'humano', cat:'Grasas y otros', nombre:'Aceite (oliva/vegetal)', cantidad:'2 botellas', costo:30000},
      {id:'m17', grupo:'humano', cat:'Grasas y otros', nombre:'Aguacate', cantidad:'mes', costo:20000},
      {id:'m18', grupo:'humano', cat:'Grasas y otros', nombre:'Sal, condimentos, especias', cantidad:'mes', costo:10000},
      // Mascotas (subgrupo "perros" de la app; incluye gatos, confirmados jul-2026)
      {id:'m19', grupo:'perros', cat:'Perros', nombre:'Cuido perros (PriceSmart 20480)', cantidad:'bulto ~20 días', costo:285600},
      {id:'m20', grupo:'perros', cat:'Gatos', nombre:'Comida gato', cantidad:'mes', costo:56095},
      {id:'m21', grupo:'perros', cat:'Gatos', nombre:'Snack gatos', cantidad:'bulto ~2 meses (prorrateado)', costo:61857},
      {id:'m22', grupo:'perros', cat:'Veterinario', nombre:'Veterinario / imprevistos', cantidad:'mes', costo:10000}
    ],
    comprasMercado: {}     // {'2026-07': {m1:true,...}}
  };
}

/* ================= Firestore: usuarios/{uid} ================= */
export async function cargarDatos(uid){
  try{
    const ref = doc(db, "usuarios", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }catch(e){
    console.error("Error cargando datos de Firestore:", e);
    return null;
  }
}

export async function guardarDatos(uid, datos){
  try{
    const ref = doc(db, "usuarios", uid);
    await setDoc(ref, datos);
    return true;
  }catch(e){
    console.error("Error guardando datos en Firestore:", e);
    return false;
  }
}

export async function borrarDatos(uid){
  try{
    await deleteDoc(doc(db, "usuarios", uid));
    return true;
  }catch(e){
    console.error("Error borrando datos de Firestore:", e);
    return false;
  }
}
