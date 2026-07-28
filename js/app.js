import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { datosIniciales, cargarDatos, guardarDatos, borrarDatos } from "./store.js";

/* ================= util ================= */
const $ = id => document.getElementById(id);
const fmt = n => '$' + Math.round(n).toLocaleString('es-CO');

let DATOS = null;
let UID = null;

function mesActual(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function inicioSemana(d=new Date()){ const x=new Date(d); const dia=(x.getDay()+6)%7; x.setDate(x.getDate()-dia); x.setHours(0,0,0,0); return x; }
function claveSemana(){ const i=inicioSemana(); return i.toISOString().slice(0,10); }

/* ================= autenticación (Firebase Auth) ================= */
let modoRegistro = false;

function traducirErrorAuth(code){
  const map = {
    'auth/email-already-in-use':'Ese correo ya tiene una cuenta. Intenta iniciar sesión.',
    'auth/invalid-email':'Correo inválido.',
    'auth/weak-password':'La contraseña es muy débil (mínimo 6 caracteres).',
    'auth/user-not-found':'No existe una cuenta con ese correo.',
    'auth/wrong-password':'Contraseña incorrecta.',
    'auth/invalid-credential':'Correo o contraseña incorrectos.',
    'auth/too-many-requests':'Demasiados intentos. Espera un momento e intenta de nuevo.',
    'auth/network-request-failed':'Sin conexión. Revisa tu internet.',
    'local/clave-corta':'Usa una contraseña de al menos 6 caracteres.',
    'local/no-coincide':'Las contraseñas no coinciden.',
    'local/no-autorizado':'Este correo no está autorizado para usar la app.'
  };
  return map[code] || ('Ocurrió un error (' + (code||'desconocido') + '). Intenta de nuevo.');
}

async function emailEstaAutorizado(email) {
  try {
    const snap = await getDoc(doc(db, 'config', 'autorizados'));
    if (!snap.exists()) return false;
    const emails = snap.data().emails || [];
    return emails.map(e => e.toLowerCase()).includes(email.toLowerCase());
  } catch {
    return false;
  }
}

$('toggleModo').addEventListener('click', ()=>{
  modoRegistro = !modoRegistro;
  $('errLogin').classList.add('oculto');
  if(modoRegistro){
    $('tituloLogin').textContent = 'Crea tu cuenta';
    $('subLogin').textContent = 'Elige un correo y una contraseña (mínimo 6 caracteres).';
    $('campoClave2').classList.remove('oculto');
    $('btnEntrar').textContent = 'Crear cuenta';
    $('toggleModo').textContent = '¿Ya tienes cuenta? Inicia sesión';
  } else {
    $('tituloLogin').textContent = 'Bienvenido de vuelta';
    $('subLogin').textContent = 'Inicia sesión para ver tu presupuesto.';
    $('campoClave2').classList.add('oculto');
    $('btnEntrar').textContent = 'Entrar';
    $('toggleModo').textContent = '¿Primera vez? Crea tu cuenta';
  }
});

$('btnEntrar').addEventListener('click', async ()=>{
  const email = $('email').value.trim();
  const clave = $('clave').value;
  const err = $('errLogin');
  err.classList.add('oculto');
  if(!email || !clave){ err.textContent='Escribe tu correo y contraseña.'; err.classList.remove('oculto'); return; }

  $('btnEntrar').disabled = true;
  try{
    if(modoRegistro){
      if(clave.length < 6) throw {code:'local/clave-corta'};
      if(clave !== $('clave2').value) throw {code:'local/no-coincide'};
      const autorizado = await emailEstaAutorizado(email);
      if(!autorizado) throw {code:'local/no-autorizado'};
      await createUserWithEmailAndPassword(auth, email, clave);
      // onAuthStateChanged se dispara solo y crea los datos iniciales
    } else {
      await signInWithEmailAndPassword(auth, email, clave);
    }
  }catch(e){
    err.textContent = traducirErrorAuth(e.code);
    err.classList.remove('oculto');
  }finally{
    $('btnEntrar').disabled = false;
  }
});
['email','clave','clave2'].forEach(id=>{
  $(id).addEventListener('keydown', e=>{ if(e.key==='Enter') $('btnEntrar').click(); });
});

onAuthStateChanged(auth, async (user)=>{
  $('cargando').classList.add('oculto');
  if(user){
    UID = user.uid;
    DATOS = await cargarDatos(UID);
    if(!DATOS){
      DATOS = datosIniciales();
      await guardarDatos(UID, DATOS);
    }
    DATOS = normalizarDatos(DATOS);
    entrar(user.email);
  } else {
    UID = null; DATOS = null;
    $('app').classList.add('oculto');
    $('pantallaLogin').classList.remove('oculto');
  }
});

function entrar(email){
  $('pantallaLogin').classList.add('oculto');
  $('app').classList.remove('oculto');
  $('fechaHoy').textContent = new Date().toLocaleDateString('es-CO',{weekday:'long', day:'numeric', month:'long', year:'numeric'});
  $('cuentaInfo').textContent = 'Sesión iniciada como ' + email + '. Tus datos viven en Firestore, ligados a esta cuenta.';
  renderTodo();
}
$('btnSalir').addEventListener('click', async ()=>{ await signOut(auth); });

/* ================= tabs ================= */
document.querySelectorAll('nav.tabs button').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('nav.tabs button').forEach(x=>x.classList.remove('activo'));
    b.classList.add('activo');
    ['resumen','semana','mercado','deudas','ajustes'].forEach(t=>$('tab-'+t).classList.add('oculto'));
    $('tab-'+b.dataset.tab).classList.remove('oculto');
  });
});

/* ================= cálculos ================= */
function gastosDe(catId, desde, hasta){
  return DATOS.gastos.filter(g=>{
    const f = new Date(g.fecha);
    return g.cat===catId && f>=desde && f<hasta;
  }).reduce((s,g)=>s+g.monto,0);
}
function rangoMes(){
  const d=new Date();
  return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth()+1, 1)];
}
function rangoSemana(){
  const i=inicioSemana(); const f=new Date(i); f.setDate(f.getDate()+7);
  return [i,f];
}

/* ---- hogar por persona ---- */
function ingresoTotal(){ return (DATOS.personas||[]).reduce((s,p)=>s+(p.ingreso||0),0); }
function proporcion(personaId){
  const tot = ingresoTotal();
  const p = (DATOS.personas||[]).find(x=>x.id===personaId);
  return (tot && p) ? p.ingreso/tot : 0;
}
// Cuánto de `valor` le toca a `personaId` según el dueño del gasto/deuda.
function parteDe(dueno, valor, personaId){
  const d = dueno || 'hector';
  if(d === personaId) return valor;
  if(d === 'compartido') return valor * proporcion(personaId);
  return 0;
}
function disponiblePersona(personaId, mIni, mFin){
  const p = (DATOS.personas||[]).find(x=>x.id===personaId);
  if(!p) return 0;
  let d = p.ingreso;
  DATOS.deudas.filter(x=>!x.nomina).forEach(x=> d -= parteDe(x.dueno, x.cuota, personaId));
  DATOS.categorias.filter(c=>c.tipo==='fijo').forEach(c=> d -= parteDe(c.dueno, c.limite, personaId));
  DATOS.categorias.filter(c=>c.tipo==='variable').forEach(c=> d -= parteDe(c.dueno, gastosDe(c.id,mIni,mFin), personaId));
  return d;
}
function nombrePersona(id){ const p=(DATOS.personas||[]).find(x=>x.id===id); return p?p.nombre:id; }
function duenoTag(dueno){
  if(!dueno || dueno==='hector') return '';
  if(dueno==='compartido') return ' · compartido';
  return ' · ' + nombrePersona(dueno);
}
// Deja cualquier documento (incluso los viejos de una sola persona) en un
// estado que la UI puede renderizar sin romperse. No inventa a Maritza: eso
// lo hace la migración 002 de forma explícita.
function normalizarDatos(d){
  if(!d) return d;
  if(!Array.isArray(d.personas)){
    d.personas = [{id:'hector', nombre:'Héctor', ingreso: (typeof d.ingreso==='number'? d.ingreso : 14050000)}];
  }
  (d.categorias||[]).forEach(c=>{ if(!c.dueno) c.dueno = (c.id==='arriendo'||c.id==='mercado')?'compartido':'hector'; });
  (d.deudas||[]).forEach(x=>{ if(!x.dueno) x.dueno='hector'; });
  return d;
}

/* ================= render ================= */
function renderTodo(){ renderResumen(); renderSemana(); renderMercado(); renderDeudas(); renderAjustes(); }

function renderResumen(){
  const [mIni,mFin] = rangoMes();
  const cuotasNoNomina = DATOS.deudas.filter(d=>!d.nomina).reduce((s,d)=>s+d.cuota,0);
  const fijos = DATOS.categorias.filter(c=>c.tipo==='fijo').reduce((s,c)=>s+c.limite,0);
  const variables = DATOS.categorias.filter(c=>c.tipo==='variable');
  const limVar = variables.reduce((s,c)=>s+c.limite,0);
  const gastadoVar = variables.reduce((s,c)=>s+gastosDe(c.id,mIni,mFin),0);
  const disponible = ingresoTotal() - cuotasNoNomina - fijos - gastadoVar;

  const el = $('disponibleMes');
  el.textContent = fmt(disponible);
  el.className = 'num ' + (disponible<0 ? 'negativo' : 'positivo');
  $('detalleHero').textContent = disponible>=0
    ? 'Lo que le queda al hogar tras fijos y deudas. Si sobra al cierre, va a matar sobrecupo.'
    : 'Este mes el hogar va por encima del plan. Sin drama: la próxima semana compensa.';
  $('hIngreso').textContent = fmt(ingresoTotal());
  $('hDeudas').textContent = fmt(cuotasNoNomina);
  $('hGastado').textContent = fmt(gastadoVar) + ' / ' + fmt(limVar);

  // desglose por persona
  renderPersonas(mIni, mFin);

  // categorías
  let html='';
  DATOS.categorias.forEach(c=>{
    const gastado = c.tipo==='variable' ? gastosDe(c.id,mIni,mFin) : c.limite;
    const pct = Math.min(100, c.limite? (gastado/c.limite*100):0);
    const clase = c.tipo!=='variable' ? '' : (gastado>c.limite?'rojo':(pct>=80?'alerta':''));
    const nota = c.tipo==='variable' ? `${fmt(gastado)} de ${fmt(c.limite)}` : `${fmt(c.limite)} · fijo`;
    html += `<div class="catFila">
      <div class="catTop"><span class="nombre">${c.nombre}${duenoTag(c.dueno)}</span><span class="cifras">${nota}</span></div>
      <div class="barra"><div class="relleno ${clase}" style="width:${c.tipo==='variable'?pct:100}%"></div></div>
    </div>`;
  });
  $('listaCategorias').innerHTML = html;

  // movimientos
  const movs = DATOS.gastos.filter(g=>{ const f=new Date(g.fecha); return f>=mIni&&f<mFin; })
    .sort((a,b)=>b.fecha.localeCompare(a.fecha));
  $('descMovs').textContent = movs.length? `${movs.length} gasto(s) registrado(s) este mes.` : 'Aún no has registrado gastos este mes. Empieza en la pestaña Semana.';
  $('listaMovs').innerHTML = movs.map(g=>{
    const cat = DATOS.categorias.find(c=>c.id===g.cat);
    return `<div class="mov">
      <div class="info"><div class="cat">${cat?cat.nombre:g.cat}</div><div class="nota">${g.nota||''} · ${new Date(g.fecha).toLocaleDateString('es-CO',{day:'numeric',month:'short'})}</div></div>
      <span class="monto">${fmt(g.monto)}</span>
      <button class="borrar" data-id="${g.id}" aria-label="Borrar gasto">✕</button>
    </div>`;
  }).join('');
  $('listaMovs').querySelectorAll('.borrar').forEach(b=>b.addEventListener('click', async ()=>{
    DATOS.gastos = DATOS.gastos.filter(g=>g.id!==b.dataset.id);
    await guardarDatos(UID, DATOS); renderTodo();
  }));
}

function renderPersonas(mIni, mFin){
  const cont = $('listaPersonas');
  if(!cont) return;
  const personas = DATOS.personas || [];
  if(personas.length < 2){ cont.innerHTML = ''; cont.closest('.carta')?.classList.add('oculto'); return; }
  cont.closest('.carta')?.classList.remove('oculto');
  cont.innerHTML = personas.map(p=>{
    const disp = disponiblePersona(p.id, mIni, mFin);
    const prop = Math.round(proporcion(p.id) * 100);
    const deudasP = DATOS.deudas.filter(d=>!d.nomina).reduce((s,d)=>s+parteDe(d.dueno, d.cuota, p.id), 0);
    const compartP = DATOS.categorias.filter(c=>c.dueno==='compartido').reduce((s,c)=>s+parteDe('compartido', c.limite, p.id), 0);
    const propiosP = DATOS.categorias.filter(c=>c.tipo==='fijo' && c.dueno===p.id).reduce((s,c)=>s+c.limite, 0);
    const clr = disp<0 ? 'var(--rojo)' : 'var(--verde)';
    return `<div style="border:1px solid var(--borde);border-radius:12px;padding:14px;margin-bottom:10px;background:#FAFBF8">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <strong style="font-family:'Space Grotesk';font-size:1.05rem">${p.nombre}</strong>
        <span style="color:var(--tinta2);font-size:.82rem">${prop}% del ingreso · aporta a compartidos</span>
      </div>
      <div style="color:var(--tinta2);font-size:.88rem;margin:6px 0 8px;line-height:1.5">
        Ingreso neto ${fmt(p.ingreso)}<br>
        − compartidos (presup.) ${fmt(compartP)} · fijos propios ${fmt(propiosP)} · deudas ${fmt(deudasP)}
      </div>
      <div style="font-family:'Space Grotesk';font-weight:600;color:${clr};font-size:1.12rem">
        Disponible: ${fmt(disp)}
      </div>
    </div>`;
  }).join('');
}

function renderSemana(){
  const [sIni,sFin] = rangoSemana();
  $('rangoSemana').textContent = 'Semana del ' + sIni.toLocaleDateString('es-CO',{day:'numeric',month:'short'}) + ' al ' + new Date(sFin-1).toLocaleDateString('es-CO',{day:'numeric',month:'short'}) + '. Se reinicia cada lunes.';
  const variables = DATOS.categorias.filter(c=>c.tipo==='variable');
  $('gridSemana').innerHTML = variables.map(c=>{
    const gastado = gastosDe(c.id, sIni, sFin);
    const queda = c.semanal - gastado;
    const luz = queda<0 ? 'roja' : (gastado/c.semanal>=0.8 ? 'amarilla' : 'verde');
    return `<div class="cajaSem">
      <div class="luz ${luz}"></div>
      <div class="nom">${c.nombre}</div>
      <div class="queda" style="color:${queda<0?'var(--rojo)':'var(--tinta)'}">${fmt(queda)}</div>
      <div class="de">de ${fmt(c.semanal)} semanales</div>
    </div>`;
  }).join('');

  // selector de categoría
  $('gCat').innerHTML = variables.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('');

  // checklist
  const ck = claveSemana();
  if(!DATOS.checklist[ck]) DATOS.checklist[ck]={};
  const items = [
    ['n1','Revisé los 3 números (mercado, gasolina, ocio)'],
    ['n2','Semáforo anotado: verde / amarillo / rojo, sin autopsia'],
    ['n3','Confirmé que los pagos de deudas salieron'],
    ['n4','Anoté el saldo total de deuda en Deudas'],
    ['n5','Decidí qué planes sociales entran esta semana']
  ];
  $('checklistSemanal').innerHTML = items.map(([id,txt])=>`
    <label class="chkPagado" style="margin-top:6px"><input type="checkbox" data-ck="${id}" ${DATOS.checklist[ck][id]?'checked':''}> ${txt}</label>
  `).join('');
  $('checklistSemanal').querySelectorAll('input').forEach(i=>i.addEventListener('change', async ()=>{
    DATOS.checklist[ck][i.dataset.ck] = i.checked;
    await guardarDatos(UID, DATOS);
  }));
}

$('btnGasto').addEventListener('click', async ()=>{
  const monto = parseInt($('gMonto').value,10);
  if(!monto || monto<=0){ $('gMonto').focus(); return; }
  DATOS.gastos.push({ id: Date.now().toString(36), fecha: new Date().toISOString(), cat: $('gCat').value, monto, nota: $('gNota').value.trim() });
  $('gMonto').value=''; $('gNota').value='';
  await guardarDatos(UID, DATOS);
  renderResumen(); renderSemana();
});

function renderMercado(){
  const mes = mesActual();
  if(!DATOS.comprasMercado[mes]) DATOS.comprasMercado[mes]={};
  const comprado = DATOS.comprasMercado[mes];

  function pintarLista(contenedorId, grupo){
    const items = DATOS.mercadoItems.filter(i=>i.grupo===grupo);
    let html=''; let catActual=null;
    items.forEach(it=>{
      if(it.cat!==catActual){ html+=`<div class="cabeceraCat">${it.cat}</div>`; catActual=it.cat; }
      const chk = !!comprado[it.id];
      html += `<div class="itemMercado ${chk?'comprado':''}">
        <label class="chk"><input type="checkbox" data-comprado="${it.id}" ${chk?'checked':''}>
          <span><span class="nombreIt">${it.nombre}</span><br><span class="cantIt">${it.cantidad}</span></span>
        </label>
        <span class="costoIt">${fmt(it.costo)}</span>
        <button class="borrar" data-borrarItem="${it.id}" aria-label="Quitar de la lista">✕</button>
      </div>`;
    });
    $(contenedorId).innerHTML = html || '<p class="desc">Sin ítems en esta lista todavía.</p>';
    $(contenedorId).querySelectorAll('[data-comprado]').forEach(i=>i.addEventListener('change', async ()=>{
      DATOS.comprasMercado[mes][i.dataset.comprado] = i.checked;
      await guardarDatos(UID, DATOS); renderMercado();
    }));
    $(contenedorId).querySelectorAll('[data-borrarItem]').forEach(b=>b.addEventListener('click', async ()=>{
      DATOS.mercadoItems = DATOS.mercadoItems.filter(x=>x.id!==b.dataset.borrarItem);
      await guardarDatos(UID, DATOS); renderMercado();
    }));
  }
  pintarLista('listaMercadoHumano','humano');
  pintarLista('listaMercadoPerros','perros');

  const totalHumano = DATOS.mercadoItems.filter(i=>i.grupo==='humano').reduce((s,i)=>s+i.costo,0);
  const totalPerros = DATOS.mercadoItems.filter(i=>i.grupo==='perros').reduce((s,i)=>s+i.costo,0);
  const totalMercado = totalHumano + totalPerros;
  const limiteCat = DATOS.categorias.find(c=>c.id==='mercado');
  const limite = limiteCat ? limiteCat.limite : totalMercado;

  $('mercadoTotal').textContent = fmt(totalMercado);
  $('mercadoTotal').style.color = totalMercado > limite ? 'var(--rojo)' : 'var(--lima)';
  $('mercadoDetalle').textContent = totalMercado > limite
    ? `Te pasas por ${fmt(totalMercado-limite)} del presupuesto de mercado. Ajusta un ítem o avísame para subir el límite.`
    : `Con margen de ${fmt(limite-totalMercado)} dentro de tu sobre de mercado.`;
  $('mLimite').textContent = fmt(limite);
  $('mHumano').textContent = fmt(totalHumano);
  $('mPerros').textContent = fmt(totalPerros);
}
$('btnMercadoItem').addEventListener('click', async ()=>{
  const costo = parseInt($('mCosto').value,10);
  const nombre = $('mNombre').value.trim();
  if(!nombre || !costo || costo<=0){ $('mNombre').focus(); return; }
  const grupo = $('mCatGrupo').value;
  DATOS.mercadoItems.push({
    id:'m'+Date.now().toString(36),
    grupo, cat: grupo==='perros'?'Perros':'Otros',
    nombre, cantidad: $('mCantidad').value.trim()||'mes', costo
  });
  $('mNombre').value=''; $('mCantidad').value=''; $('mCosto').value='';
  await guardarDatos(UID, DATOS);
  renderMercado();
});

function renderDeudas(){
  const mes = mesActual();
  if(!DATOS.pagosMes[mes]) DATOS.pagosMes[mes]={};
  const pagos = DATOS.pagosMes[mes];
  $('listaDeudas').innerHTML = DATOS.deudas.map(d=>`
    <div class="deuda ${pagos[d.id]?'pagada':''}">
      <div class="top">
        <div><div class="nom">${d.nombre}</div><div class="cuota">Cuota: <input data-cuota="${d.id}" value="${fmt(d.cuota)}" inputmode="numeric" style="width:120px;border:1px solid var(--borde);border-radius:6px;padding:3px 6px;background:#FAFBF8;font-family:'Space Grotesk';font-weight:600">${d.nomina?' · descontada de nómina':''}</div></div>
        <div style="text-align:right">
          <div class="cuota">Saldo</div>
          <input class="saldoNum" data-saldo="${d.id}" value="${fmt(d.saldo||0)}" inputmode="numeric" style="width:150px;text-align:right;border:1px solid var(--borde);border-radius:8px;padding:5px 8px;background:#FAFBF8">
        </div>
      </div>
      <label class="chkPagado"><input type="checkbox" data-pago="${d.id}" ${pagos[d.id]?'checked':''} ${d.nomina?'checked disabled':''}> ${d.nomina?'Se paga sola cada mes':'Pagada este mes'}</label>
    </div>
  `).join('');
  const total = DATOS.deudas.reduce((s,d)=>s+(parseInt(d.saldo,10)||0),0);
  $('totalDeuda').textContent = fmt(total);

  $('listaDeudas').querySelectorAll('[data-pago]').forEach(i=>i.addEventListener('change', async ()=>{
    DATOS.pagosMes[mes][i.dataset.pago] = i.checked;
    await guardarDatos(UID, DATOS); renderDeudas();
  }));
  $('listaDeudas').querySelectorAll('[data-saldo]').forEach(i=>i.addEventListener('change', async ()=>{
    const d = DATOS.deudas.find(x=>x.id===i.dataset.saldo);
    d.saldo = parseInt(i.value.replace(/\D/g,''),10)||0;
    await guardarDatos(UID, DATOS); renderDeudas();
  }));
  $('listaDeudas').querySelectorAll('[data-cuota]').forEach(i=>i.addEventListener('change', async ()=>{
    const d = DATOS.deudas.find(x=>x.id===i.dataset.cuota);
    d.cuota = parseInt(i.value.replace(/\D/g,''),10)||0;
    await guardarDatos(UID, DATOS); renderDeudas(); renderResumen();
  }));
}

function renderAjustes(){
  let html = (DATOS.personas||[]).map(p=>
    `<div class="filaAjuste"><label>Ingreso neto · ${p.nombre}</label><input data-ing="${p.id}" value="${p.ingreso}" inputmode="numeric"></div>`
  ).join('');
  DATOS.categorias.forEach(c=>{
    html += `<div class="filaAjuste"><label>${c.nombre}${duenoTag(c.dueno)} ${c.tipo==='variable'?'(mensual)':''}</label><input data-cat="${c.id}" value="${c.limite}" inputmode="numeric"></div>`;
    if(c.tipo==='variable') html += `<div class="filaAjuste"><label style="color:var(--tinta2);font-weight:400">↳ límite semanal</label><input data-sem="${c.id}" value="${c.semanal}" inputmode="numeric"></div>`;
  });
  $('listaAjustes').innerHTML = html;
}
$('btnGuardarAjustes').addEventListener('click', async ()=>{
  const v = s => parseInt(String(s).replace(/\D/g,''),10)||0;
  $('listaAjustes').querySelectorAll('input').forEach(i=>{
    if(i.dataset.ing){ const p=DATOS.personas.find(x=>x.id===i.dataset.ing); if(p) p.ingreso=v(i.value); }
    if(i.dataset.cat){ const c=DATOS.categorias.find(x=>x.id===i.dataset.cat); if(c) c.limite=v(i.value); }
    if(i.dataset.sem){ const c=DATOS.categorias.find(x=>x.id===i.dataset.sem); if(c) c.semanal=v(i.value); }
  });
  await guardarDatos(UID, DATOS);
  renderTodo();
  $('btnGuardarAjustes').textContent='Guardado ✓';
  setTimeout(()=>$('btnGuardarAjustes').textContent='Guardar cambios',1500);
});

$('btnCambiarClave').addEventListener('click', async ()=>{
  const actual = prompt('Contraseña actual:'); if(actual===null) return;
  const nueva = prompt('Nueva contraseña (mínimo 6 caracteres):'); if(!nueva || nueva.length<6){ alert('Muy corta. No se cambió.'); return; }
  try{
    const cred = EmailAuthProvider.credential(auth.currentUser.email, actual);
    await reauthenticateWithCredential(auth.currentUser, cred);
    await updatePassword(auth.currentUser, nueva);
    alert('Contraseña actualizada.');
  }catch(e){
    alert('No se pudo cambiar: ' + traducirErrorAuth(e.code));
  }
});
$('btnReset').addEventListener('click', async ()=>{
  if(!confirm('¿Borrar TODOS los datos de tu presupuesto en Firestore? Esto no se puede deshacer.')) return;
  if(!confirm('Última confirmación: se pierde todo el historial guardado.')) return;
  await borrarDatos(UID);
  DATOS = datosIniciales();
  await guardarDatos(UID, DATOS);
  renderTodo();
  alert('Datos reiniciados a los valores base.');
});
