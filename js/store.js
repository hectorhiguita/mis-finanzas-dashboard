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

/* ================= datos iniciales (tu realidad, Héctor) ================= */
export function datosIniciales(){
  return {
    ingreso: 14050000,
    categorias: [
      // fijas (no se registran gastos, solo informan)
      {id:'arriendo', nombre:'Arriendo', limite:1550000, tipo:'fijo'},
      {id:'epm1', nombre:'EPM casa', limite:210000, tipo:'fijo'},
      {id:'epm2', nombre:'EPM mamá', limite:200000, tipo:'fijo'},
      {id:'agua', nombre:'Agua', limite:75000, tipo:'fijo'},
      {id:'gaspipeta', nombre:'Gas pipeta', limite:200000, tipo:'fijo'},
      // variables (semáforo)
      {id:'mercado', nombre:'Mercado', limite:1500000, tipo:'variable', semanal:375000},
      {id:'gasolina', nombre:'Gasolina', limite:720000, tipo:'variable', semanal:170000},
      {id:'ocio', nombre:'Ocio sin culpa', limite:300000, tipo:'variable', semanal:75000},
      {id:'colchon', nombre:'Colchón / emergencias', limite:100000, tipo:'fijo'}
    ],
    deudas: [
      {id:'bbva', nombre:'Préstamo BBVA (carro)', cuota:2873305, saldo:119956722},
      {id:'bbvavisa', nombre:'Visa Infinite BBVA (mín.)', cuota:1693238, saldo:25444025},
      {id:'occid', nombre:'Préstamo B. Occidente (moto)', cuota:1891570, saldo:66185003},
      {id:'visa', nombre:'Visa Occidente (mín. alterno)', cuota:1353000, saldo:27588554},
      {id:'davi', nombre:'Davibank', cuota:1204578, saldo:1204578},
      {id:'nu', nombre:'Nu', cuota:317590, saldo:2907007},
      {id:'siste1', nombre:'Sistecrédito · Garmin (2/6)', cuota:575384, saldo:2567837},
      {id:'siste2', nombre:'Sistecrédito · Luegopago SOAT (2/4)', cuota:240348, saldo:650164},
      {id:'siste3', nombre:'Sistecrédito · KOAJ (1/2)', cuota:144214, saldo:250700},
      {id:'addi', nombre:'Addi', cuota:312165, saldo:874265},
      {id:'bancol', nombre:'Bancolombia libre inversión (nómina)', cuota:2846006, saldo:0, nomina:true}
    ],
    gastos: [],           // {id, fecha, cat, monto, nota}
    pagosMes: {},         // {'2026-07': {bbva:true,...}}
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
      // Perros
      {id:'m19', grupo:'perros', cat:'Perros', nombre:'Alimento perros', cantidad:'mes', costo:300000}
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
