/* ==========================================================
   Moneorq, lógica de la app

   Funciona de dos maneras:
   - sin cuenta: todo vive en localStorage y no sale de este navegador.
   - con cuenta: además se guarda en la nube y aparece solo en los otros
     aparatos. Si no hay internet, se apunta igual y se sube después.
   ========================================================== */

const CLAVE_DATOS = "moneorq-datos";
const CLAVE_MODO = "moneorq-modo";

const CATEGORIAS_GASTO = [
  { id: "supermercado", nombre: "Supermercado / comida", emoji: "🛒" },
  { id: "restaurante", nombre: "Comer o tomar algo fuera", emoji: "🍽️" },
  { id: "transporte", nombre: "Transporte / gasolina", emoji: "🚌" },
  { id: "salud", nombre: "Salud / farmacia", emoji: "💊" },
  { id: "ropa", nombre: "Ropa y calzado", emoji: "👕" },
  { id: "hogar", nombre: "Cosas de casa", emoji: "🧹" },
  { id: "ocio", nombre: "Ocio / caprichos", emoji: "🎮" },
  { id: "regalos", nombre: "Regalos", emoji: "🎁" },
  { id: "otros", nombre: "Otros", emoji: "📦" },
];

const CATEGORIAS_INGRESO = [
  { id: "nomina", nombre: "Nómina / pensión", emoji: "💼" },
  { id: "extra", nombre: "Plus / trabajillo extra", emoji: "✨" },
  { id: "amigos", nombre: "De amigos o familia", emoji: "🤝" },
  { id: "otros", nombre: "Otro ingreso", emoji: "📦" },
];

const CATEGORIAS_FIJO = [
  { id: "vivienda", nombre: "Alquiler / hipoteca", emoji: "🏠" },
  { id: "suministros", nombre: "Luz / agua / gas", emoji: "💡" },
  { id: "internet", nombre: "Internet / móvil", emoji: "📱" },
  { id: "suscripcion", nombre: "Suscripción (Spotify, Prime…)", emoji: "📺" },
  { id: "banco", nombre: "Banco / seguros / préstamos", emoji: "🏦" },
  { id: "otros", nombre: "Otro gasto fijo", emoji: "📦" },
];

const COLORES = ["#2e7d5b", "#2563b8", "#7c4fc4", "#c2417f", "#c45c1d", "#b8862e", "#37808c", "#5a5f6b"];

const datosPorDefecto = () => ({
  ajustes: { nombre: "Mi monedero", emoji: "💶", color: COLORES[0], tema: "auto", alias: "" },
  ingresos: [],   // { id, nombre, tipo, cantidad, dia, mensual, mes, desde }
  fijos: [],      // { id, nombre, cantidad, dia, categoria, periodicidad, fin, desde }
  gastos: [],     // { id, cantidad, categoria, nota, fecha }
  deudas: [],     // { id, acreedor, deudor, concepto, cantidad, fecha, pagada }
  personas: [],   // { id, nombre, alias } de la gente con la que compartes deudas
});

let datos = cargarDatos();
let modo = localStorage.getItem(CLAVE_MODO) || null;

function cargarDatos() {
  try {
    const crudo = localStorage.getItem(CLAVE_DATOS);
    if (!crudo) return datosPorDefecto();
    const guardado = JSON.parse(crudo);
    const combinado = { ...datosPorDefecto(), ...guardado, ajustes: { ...datosPorDefecto().ajustes, ...guardado.ajustes } };
    // datos guardados con versiones anteriores de la app.
    // desde: null significa "cuenta desde siempre", para no falsear los meses viejos.
    combinado.ingresos = combinado.ingresos.map((i) => ({ tipo: "nomina", desde: null, ...i }));
    combinado.fijos = combinado.fijos.map((f) => ({ periodicidad: "mensual", fin: null, desde: null, ...f }));
    return combinado;
  } catch {
    return datosPorDefecto();
  }
}

function guardarDatos() {
  localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos));
}

/* ---------- utilidades ---------- */

const $ = (sel) => document.querySelector(sel);

const formatoMoneda = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const dinero = (n) => formatoMoneda.format(n);

// identificador compatible con la nube; el de repuesto solo se usa sin cuenta
const nuevoId = () =>
  (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const dosDigitos = (n) => String(n).padStart(2, "0");

const mesActualClave = () => {
  const d = new Date();
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}`;
};

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
};

const diaISO = (mesClave, dia) => `${mesClave}-${dosDigitos(dia)}`;

function categoriaDe(lista, id) {
  return lista.find((c) => c.id === id) || lista[lista.length - 1];
}

function nombreDelMes(mesClave) {
  const [anio, mes] = mesClave.split("-").map(Number);
  const texto = new Date(anio, mes - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  // solo la primera letra en mayúscula: "Septiembre de 2026", nunca "Septiembre De 2026"
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* ---------- meses (claves tipo "2026-09") ---------- */

const mesesEntre = (a, b) => {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
};

const sumarMeses = (mesClave, n) => {
  const [y, m] = mesClave.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${dosDigitos((total % 12) + 1)}`;
};

// mes que se está mirando ahora mismo, no tiene por qué ser el de hoy
let mesVisible = mesActualClave();

/* ---------- qué cuenta en cada mes ---------- */

// pagos que le quedan a un fijo desde el mes dado (Infinity = para siempre)
const mesesRestantes = (f, mes) => (f.fin ? Math.max(0, mesesEntre(mes, f.fin)) : Infinity);

// nada cuenta en los meses anteriores a su alta
const yaExistiaEn = (item, mes) => !item.desde || mesesEntre(item.desde, mes) >= 0;

const fijoActivoEn = (f, mes) => yaExistiaEn(f, mes) && mesesRestantes(f, mes) > 0;

const ingresoActivoEn = (i, mes) => (i.mensual ? yaExistiaEn(i, mes) : i.mes === mes);

// coste de un gasto fijo repartido en un mes (los anuales se dividen entre 12)
const fijoAlMes = (f) => (f.periodicidad === "anual" ? f.cantidad / 12 : f.cantidad);

function calcularMes(mes = mesVisible) {
  const anio = mes.slice(0, 4);

  const ingresosMes = datos.ingresos
    .filter((i) => ingresoActivoEn(i, mes))
    .reduce((suma, i) => suma + i.cantidad, 0);

  const fijosActivos = datos.fijos.filter((f) => fijoActivoEn(f, mes));
  const fijosMes = fijosActivos.reduce((suma, f) => suma + fijoAlMes(f), 0);

  const gastosMes = datos.gastos
    .filter((g) => g.fecha.startsWith(mes))
    .reduce((suma, g) => suma + g.cantidad, 0);

  // vista anual: mensuales × 12 (o × los meses que queden) + puntuales de este año
  const ingresosAnio = datos.ingresos.reduce(
    (suma, i) => suma + (i.mensual ? i.cantidad * 12 : (i.mes || "").startsWith(anio) ? i.cantidad : 0), 0);
  const fijosAnio = fijosActivos.reduce(
    (suma, f) => suma + (f.periodicidad === "anual" ? f.cantidad : f.cantidad * Math.min(mesesRestantes(f, mes), 12)), 0);

  return { ingresosMes, fijosMes, gastosMes, ingresosAnio, fijosAnio, disponible: ingresosMes - fijosMes - gastosMes };
}

// todos los meses que tienen algo que enseñar, del más nuevo al más viejo
function mesesConDatos() {
  const meses = new Set([mesActualClave(), mesVisible]);
  datos.gastos.forEach((g) => meses.add(g.fecha.slice(0, 7)));
  datos.ingresos.forEach((i) => { if (i.mes) meses.add(i.mes); if (i.desde) meses.add(i.desde); });
  datos.fijos.forEach((f) => { if (f.desde) meses.add(f.desde); });
  return [...meses].sort().reverse();
}

/* ---------- avisos ---------- */

let temporizadorAviso;

function avisar(texto) {
  const el = $("#aviso");
  el.textContent = texto;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("visible"));
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => {
    el.classList.remove("visible");
    setTimeout(() => { el.hidden = true; }, 300);
  }, 2800);
}

/* ==========================================================
   Guardar: primero aquí, y si hay cuenta, también en la nube
   ========================================================== */

async function anadirFila(tabla, fila) {
  datos[tabla].push(fila);
  guardarDatos();
  pintarTodo();
  if (!Nube.hayCuenta()) return;
  const r = await Nube.insertar(tabla, fila);
  if (!r.ok) avisar("📴 Apuntado aquí, se subirá cuando vuelva internet");
  pintarEstadoNube();
}

async function cambiarFila(tabla, id, cambios) {
  const fila = datos[tabla].find((f) => f.id === id);
  if (!fila) return;
  Object.assign(fila, cambios);
  guardarDatos();
  pintarTodo();
  if (!Nube.hayCuenta()) return;
  const r = await Nube.actualizar(tabla, id, cambios);
  if (!r.ok) avisar("📴 Cambiado aquí, se subirá cuando vuelva internet");
  pintarEstadoNube();
}

async function quitarFila(tabla, id) {
  datos[tabla] = datos[tabla].filter((f) => f.id !== id);
  guardarDatos();
  pintarTodo();
  if (!Nube.hayCuenta()) return;
  const r = await Nube.borrar(tabla, id);
  if (!r.ok) avisar("📴 Borrado aquí, se subirá cuando vuelva internet");
  pintarEstadoNube();
}

/* ---------- pintado ---------- */

function pintarTodo() {
  pintarCabecera();
  pintarResumen();
  pintarPrimerosPasos();
  pintarCalendario();
  pintarMovimientos();
  pintarMeses();
  pintarIngresos();
  pintarFijos();
  pintarGastos();
  pintarDeudas();
  pintarAjustes();
  pintarEstadoNube();
}

function pintarCabecera() {
  const { nombre, emoji, color, tema } = datos.ajustes;
  $("#monederoNombre").textContent = nombre;
  $("#monederoEmoji").textContent = emoji;
  document.documentElement.style.setProperty("--acento", color);
  document.body.dataset.tema = tema;

  $("#mesActual").textContent = nombreDelMes(mesVisible);

  const distancia = mesesEntre(mesActualClave(), mesVisible);
  $("#btnVolverHoy").hidden = distancia === 0;
  $("#saldoEtiqueta").textContent =
    distancia === 0 ? "Te queda este mes" : distancia < 0 ? "Le quedó a ese mes" : "Le quedará a ese mes";

  const { ingresosMes, fijosMes, gastosMes, disponible } = calcularMes();
  const saldoEl = $("#saldoDisponible");
  saldoEl.textContent = dinero(disponible);
  saldoEl.classList.toggle("en-rojo", disponible < 0);

  const usado = fijosMes + gastosMes;
  const porcentaje = ingresosMes > 0 ? Math.min(100, (usado / ingresosMes) * 100) : 0;
  $("#barraProgreso").style.width = porcentaje + "%";
  $("#barraDetalle").textContent = ingresosMes > 0
    ? `Has usado ${dinero(usado)} de ${dinero(ingresosMes)} (${Math.round(porcentaje)}%)`
    : "Apunta tus ingresos para ver cuánto te queda";
}

// los tres primeros pasos, que desaparecen solos cuando están hechos
function pintarPrimerosPasos() {
  const pasos = [
    { hecho: datos.ingresos.length > 0, texto: "Apunta lo que cobras", tab: "ingresos" },
    { hecho: datos.fijos.length > 0, texto: "Apunta lo que pagas siempre", tab: "fijos" },
    { hecho: datos.gastos.length > 0, texto: "Apunta tu primer gasto", tab: "gastos" },
  ];

  $("#primerosPasos").hidden = pasos.every((p) => p.hecho);

  const lista = $("#pasosLista");
  lista.innerHTML = "";
  for (const paso of pasos) {
    const li = document.createElement("li");
    li.className = "paso" + (paso.hecho ? " hecho" : "");

    const marca = document.createElement("span");
    marca.className = "paso-marca";
    marca.textContent = paso.hecho ? "✅" : "⬜";

    const texto = document.createElement("span");
    texto.className = "paso-texto";
    texto.textContent = paso.texto;

    li.append(marca, texto);

    if (!paso.hecho) {
      const ir = document.createElement("button");
      ir.type = "button";
      ir.className = "paso-ir";
      ir.textContent = "Ir";
      ir.addEventListener("click", () => irATab(paso.tab));
      li.append(ir);
    }

    lista.append(li);
  }
}

function pintarEstadoNube() {
  const el = $("#estadoNube");
  const pendientes = Nube.cola().length;
  if (Nube.hayCuenta()) {
    el.textContent = pendientes
      ? `📴 ${pendientes} ${pendientes === 1 ? "cambio" : "cambios"} esperando internet`
      : "☁️ Guardado en la nube";
  } else {
    el.textContent = "📱 Solo en este aparato";
  }
}

function pintarResumen() {
  const { ingresosMes, fijosMes, gastosMes, ingresosAnio, fijosAnio } = calcularMes();
  $("#resumenIngresos").textContent = dinero(ingresosMes);
  $("#resumenFijos").textContent = dinero(fijosMes);
  $("#resumenGastos").textContent = dinero(gastosMes);

  const anual = $("#resumenAnual");
  anual.innerHTML = "";
  if (ingresosAnio === 0 && fijosAnio === 0) {
    anual.textContent = "Apunta ingresos y gastos fijos para ver tu año de un vistazo.";
  } else {
    const entra = document.createElement("strong");
    entra.className = "positivo";
    entra.textContent = dinero(ingresosAnio);
    const sale = document.createElement("strong");
    sale.className = "negativo";
    sale.textContent = dinero(fijosAnio);
    anual.append("Ingresas ", entra, " al año y pagas ", sale, " en gastos fijos.");
  }
}

/* ---------- calendario del mes ---------- */

function pintarCalendario() {
  const rejilla = $("#calendarioDias");
  rejilla.innerHTML = "";

  const [anio, mes] = mesVisible.split("-").map(Number);
  const diasDelMes = new Date(anio, mes, 0).getDate();
  // getDay() da 0 el domingo, aquí la semana empieza en lunes
  const huecoInicial = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;

  for (let i = 0; i < huecoInicial; i++) {
    const hueco = document.createElement("span");
    hueco.className = "dia hueco";
    rejilla.append(hueco);
  }

  const ingresosDelMes = datos.ingresos.filter((i) => ingresoActivoEn(i, mesVisible));
  const fijosDelMes = datos.fijos.filter((f) => fijoActivoEn(f, mesVisible));

  for (let dia = 1; dia <= diasDelMes; dia++) {
    const fecha = diaISO(mesVisible, dia);
    const gastadoHoy = datos.gastos
      .filter((g) => g.fecha === fecha)
      .reduce((suma, g) => suma + g.cantidad, 0);
    const hayIngreso = ingresosDelMes.some((i) => i.dia === dia);
    const hayFijo = fijosDelMes.some((f) => f.dia === dia);

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "dia";
    if (fecha === hoyISO()) boton.classList.add("hoy");
    if (gastadoHoy > 0) boton.classList.add("con-gasto");
    boton.title = `Apuntar un gasto del ${dia} de ${nombreDelMes(mesVisible)}`;

    const numero = document.createElement("span");
    numero.className = "dia-numero";
    numero.textContent = dia;
    boton.append(numero);

    if (gastadoHoy > 0) {
      const importe = document.createElement("span");
      importe.className = "dia-importe";
      importe.textContent = Math.round(gastadoHoy) + " €";
      boton.append(importe);
    }

    if (hayIngreso || hayFijo || gastadoHoy > 0) {
      const puntos = document.createElement("span");
      puntos.className = "dia-puntos";
      if (hayIngreso) puntos.append(crearPunto("punto-ingreso"));
      if (hayFijo) puntos.append(crearPunto("punto-fijo"));
      if (gastadoHoy > 0) puntos.append(crearPunto("punto-gasto"));
      boton.append(puntos);
    }

    boton.addEventListener("click", () => {
      cancelarEdicion();
      irATab("gastos");
      $("#inputFechaGasto").value = fecha;
      $("#inputCantidadGasto").focus();
      avisar(`Apuntando un gasto del ${dia} de ${nombreDelMes(mesVisible)}`);
    });

    rejilla.append(boton);
  }
}

function crearPunto(clase) {
  const punto = document.createElement("i");
  punto.className = "punto " + clase;
  return punto;
}

/* ---------- listas ---------- */

function elementoMovimiento({ emoji, nombre, detalle, cantidad, esGasto, alBorrar, alTocar, textoCantidad }) {
  const li = document.createElement("li");

  const icono = document.createElement("span");
  icono.className = "mov-icono";
  icono.textContent = emoji;

  const datosDiv = document.createElement("div");
  datosDiv.className = "mov-datos";
  const nombreDiv = document.createElement("div");
  nombreDiv.className = "mov-nombre";
  nombreDiv.textContent = nombre;
  const detalleDiv = document.createElement("div");
  detalleDiv.className = "mov-detalle";
  detalleDiv.textContent = detalle;
  datosDiv.append(nombreDiv, detalleDiv);

  const cantidadSpan = document.createElement("span");
  cantidadSpan.className = "mov-cantidad " + (esGasto ? "negativo" : "positivo");
  cantidadSpan.textContent = textoCantidad || (esGasto ? "−" : "+") + dinero(cantidad);

  li.append(icono, datosDiv, cantidadSpan);

  if (alTocar) {
    li.classList.add("tocable");
    li.title = "Tocar para corregirlo";
    [icono, datosDiv, cantidadSpan].forEach((parte) => parte.addEventListener("click", alTocar));
  }

  if (alBorrar) {
    const borrar = document.createElement("button");
    borrar.className = "mov-borrar";
    borrar.textContent = "✕";
    borrar.title = "Borrar";
    borrar.addEventListener("click", alBorrar);
    li.append(borrar);
  }

  return li;
}

function pintarMovimientos() {
  const lista = $("#listaMovimientos");
  lista.innerHTML = "";

  const gastosMes = datos.gastos
    .filter((g) => g.fecha.startsWith(mesVisible))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 8);

  for (const gasto of gastosMes) {
    const cat = categoriaDe(CATEGORIAS_GASTO, gasto.categoria);
    lista.append(elementoMovimiento({
      emoji: cat.emoji,
      nombre: gasto.nota || cat.nombre,
      detalle: `${cat.nombre} · día ${Number(gasto.fecha.slice(8, 10))}`,
      cantidad: gasto.cantidad,
      esGasto: true,
      alTocar: () => editarGasto(gasto.id),
    }));
  }

  $("#vacioMovimientos").classList.toggle("visible", gastosMes.length === 0);
}

function pintarMeses() {
  const lista = $("#listaMeses");
  lista.innerHTML = "";

  for (const mes of mesesConDatos()) {
    const { ingresosMes, fijosMes, gastosMes, disponible } = calcularMes(mes);
    if (ingresosMes === 0 && fijosMes === 0 && gastosMes === 0 && mes !== mesActualClave()) continue;

    const li = document.createElement("li");
    li.className = "mes-fila" + (mes === mesVisible ? " activa" : "");

    const datosDiv = document.createElement("div");
    datosDiv.className = "mov-datos";
    const nombreDiv = document.createElement("div");
    nombreDiv.className = "mov-nombre";
    nombreDiv.textContent = nombreDelMes(mes) + (mes === mesActualClave() ? " (este mes)" : "");
    const detalleDiv = document.createElement("div");
    detalleDiv.className = "mov-detalle";
    detalleDiv.textContent = `Entró ${dinero(ingresosMes)} · se fue ${dinero(fijosMes + gastosMes)}`;
    datosDiv.append(nombreDiv, detalleDiv);

    const saldo = document.createElement("span");
    saldo.className = "mov-cantidad " + (disponible < 0 ? "negativo" : "positivo");
    saldo.textContent = dinero(disponible);

    li.append(datosDiv, saldo);
    li.addEventListener("click", () => {
      mesVisible = mes;
      pintarTodo();
      irATab("inicio");
      avisar(`Mirando ${nombreDelMes(mes)}`);
    });

    lista.append(li);
  }

  $("#vacioMeses").classList.toggle("visible", lista.children.length === 0);
}

function pintarIngresos() {
  const lista = $("#listaIngresos");
  lista.innerHTML = "";
  for (const ingreso of datos.ingresos) {
    const cat = categoriaDe(CATEGORIAS_INGRESO, ingreso.tipo);
    lista.append(elementoMovimiento({
      emoji: cat.emoji,
      nombre: ingreso.nombre,
      detalle: `${cat.nombre} · ${ingreso.mensual ? `cada mes, el día ${ingreso.dia}` : `solo en ${nombreDelMes(ingreso.mes)}, el día ${ingreso.dia}`}`,
      cantidad: ingreso.cantidad,
      esGasto: false,
      alBorrar: () => {
        if (!confirm(`¿Borrar el ingreso "${ingreso.nombre}"?`)) return;
        quitarFila("ingresos", ingreso.id);
        avisar("Ingreso borrado");
      },
    }));
  }
  const { ingresosMes, ingresosAnio } = calcularMes();
  $("#totalIngresos").textContent = datos.ingresos.length
    ? `Ingresas ${dinero(ingresosMes)} en ${nombreDelMes(mesVisible)} · ${dinero(ingresosAnio)} al año`
    : "";
  $("#vacioIngresos").classList.toggle("visible", datos.ingresos.length === 0);
}

function pintarFijos() {
  const lista = $("#listaFijos");
  lista.innerHTML = "";
  const ordenados = [...datos.fijos].sort((a, b) => a.dia - b.dia);

  for (const fijo of ordenados) {
    const cat = categoriaDe(CATEGORIAS_FIJO, fijo.categoria);
    const esAnual = fijo.periodicidad === "anual";
    const restantes = mesesRestantes(fijo, mesVisible);
    let detalle;
    if (!yaExistiaEn(fijo, mesVisible)) {
      detalle = `${cat.nombre} · aún no lo pagabas en ${nombreDelMes(mesVisible)}`;
    } else if (restantes === 0) {
      detalle = `${cat.nombre} · ✅ terminado de pagar, ya no cuenta`;
    } else if (esAnual) {
      detalle = `${cat.nombre} · ${dinero(fijo.cantidad)} una vez al año · sale a ${dinero(fijo.cantidad / 12)}/mes`;
    } else if (restantes !== Infinity) {
      detalle = `${cat.nombre} · día ${fijo.dia} · ${restantes === 1 ? "queda 1 mes" : `quedan ${restantes} meses`}`;
    } else {
      detalle = `${cat.nombre} · te lo cobran el día ${fijo.dia}`;
    }

    lista.append(elementoMovimiento({
      emoji: cat.emoji,
      nombre: fijo.nombre,
      detalle,
      cantidad: fijoAlMes(fijo),
      esGasto: true,
      alBorrar: () => {
        if (!confirm(`¿Borrar el gasto fijo "${fijo.nombre}"?`)) return;
        quitarFila("fijos", fijo.id);
        avisar("Gasto fijo borrado");
      },
    }));
  }

  const { fijosMes, fijosAnio } = calcularMes();
  $("#totalFijos").textContent = datos.fijos.length
    ? `Total fijo: ${dinero(fijosMes)} al mes · ${dinero(fijosAnio)} al año`
    : "";
  $("#vacioFijos").classList.toggle("visible", datos.fijos.length === 0);
}

function pintarGastos() {
  const lista = $("#listaGastos");
  lista.innerHTML = "";
  const gastosMes = datos.gastos
    .filter((g) => g.fecha.startsWith(mesVisible))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  for (const gasto of gastosMes) {
    const cat = categoriaDe(CATEGORIAS_GASTO, gasto.categoria);
    lista.append(elementoMovimiento({
      emoji: cat.emoji,
      nombre: gasto.nota || cat.nombre,
      detalle: `${cat.nombre} · día ${Number(gasto.fecha.slice(8, 10))}`,
      cantidad: gasto.cantidad,
      esGasto: true,
      alTocar: () => editarGasto(gasto.id),
      alBorrar: () => {
        if (editandoGastoId === gasto.id) cancelarEdicion();
        quitarFila("gastos", gasto.id);
        avisar("Gasto borrado");
      },
    }));
  }

  const total = gastosMes.reduce((s, g) => s + g.cantidad, 0);
  $("#totalGastosMes").textContent = gastosMes.length
    ? `Gastado en ${nombreDelMes(mesVisible)}: ${dinero(total)}`
    : "";
  $("#vacioGastos").classList.toggle("visible", gastosMes.length === 0);
}

/* ---------- deudas ---------- */

function nombreDePersona(id) {
  const persona = datos.personas.find((p) => p.id === id);
  if (!persona) return "alguien";
  return persona.nombre && persona.nombre !== "Mi monedero" ? persona.nombre : persona.alias;
}

function pintarDeudas() {
  const conCuenta = Nube.hayCuenta();
  $("#deudasSinCuenta").hidden = conCuenta;
  $("#formDeuda").hidden = !conCuenta;

  const yo = conCuenta ? Nube.usuario.id : null;
  const abiertas = datos.deudas.filter((d) => !d.pagada);
  const teDeben = abiertas.filter((d) => d.acreedor === yo).reduce((s, d) => s + d.cantidad, 0);
  const debes = abiertas.filter((d) => d.deudor === yo).reduce((s, d) => s + d.cantidad, 0);
  $("#resumenTeDeben").textContent = dinero(teDeben);
  $("#resumenDebes").textContent = dinero(debes);

  const lista = $("#listaDeudas");
  lista.innerHTML = "";

  for (const deuda of datos.deudas) {
    const meDeben = deuda.acreedor === yo;
    const otra = meDeben ? deuda.deudor : deuda.acreedor;

    const li = elementoMovimiento({
      emoji: deuda.pagada ? "✅" : meDeben ? "🫴" : "💸",
      nombre: deuda.concepto,
      detalle: deuda.pagada
        ? `Ya está saldada · ${deuda.fecha}`
        : meDeben
          ? `${nombreDePersona(otra)} te lo debe · ${deuda.fecha}`
          : `Se lo debes a ${nombreDePersona(otra)} · ${deuda.fecha}`,
      cantidad: deuda.cantidad,
      esGasto: !meDeben,
      textoCantidad: dinero(deuda.cantidad),
      alTocar: () => {
        const texto = deuda.pagada ? "¿Marcar esta deuda como NO pagada?" : "¿Marcar esta deuda como pagada?";
        if (!confirm(texto)) return;
        cambiarFila("deudas", deuda.id, { pagada: !deuda.pagada });
        avisar(deuda.pagada ? "Deuda reabierta" : "✅ Deuda saldada");
      },
      alBorrar: () => {
        if (!confirm(`¿Borrar la deuda "${deuda.concepto}"?`)) return;
        quitarFila("deudas", deuda.id);
        avisar("Deuda borrada");
      },
    });
    if (deuda.pagada) li.classList.add("saldada");
    lista.append(li);
  }

  $("#vacioDeudas").classList.toggle("visible", datos.deudas.length === 0);
}

/* ---------- ajustes y cuenta ---------- */

function pintarAjustes() {
  $("#ajusteNombre").value = datos.ajustes.nombre;
  $("#ajusteEmoji").value = datos.ajustes.emoji;

  const paleta = $("#paletaColores");
  paleta.innerHTML = "";
  for (const color of COLORES) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "color-opcion" + (color === datos.ajustes.color ? " activo" : "");
    boton.style.background = color;
    boton.title = "Elegir este color";
    boton.addEventListener("click", () => {
      datos.ajustes.color = color;
      guardarDatos();
      pintarTodo();
      if (Nube.hayCuenta()) Nube.guardarPerfil(datos.ajustes).catch(() => {});
    });
    paleta.append(boton);
  }

  document.querySelectorAll("#opcionesTema .chip").forEach((chip) => {
    chip.classList.toggle("activo", chip.dataset.tema === datos.ajustes.tema);
  });

  const conCuenta = Nube.hayCuenta();
  $("#cajaCuenta").hidden = !conCuenta;
  $("#cajaSinCuenta").hidden = conCuenta;
  if (conCuenta) {
    $("#cuentaCorreo").textContent = `Has entrado como ${Nube.usuario.email}`;
    $("#inputAlias").value = datos.ajustes.alias || "";
  }
}

/* ---------- chips de categorías ---------- */

function pintarChips(contenedorSel, categorias, campoSel) {
  const contenedor = $(contenedorSel);
  const campo = $(campoSel);
  contenedor.innerHTML = "";
  if (!campo.value) campo.value = categorias[0].id;

  for (const cat of categorias) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip chip-categoria" + (cat.id === campo.value ? " activo" : "");
    chip.dataset.id = cat.id;
    chip.textContent = `${cat.emoji} ${cat.nombre}`;
    chip.addEventListener("click", () => {
      campo.value = cat.id;
      contenedor.querySelectorAll(".chip").forEach((c) => c.classList.toggle("activo", c.dataset.id === cat.id));
    });
    contenedor.append(chip);
  }
}

function marcarChip(contenedorSel, campoSel, id) {
  $(campoSel).value = id;
  $(contenedorSel).querySelectorAll(".chip").forEach((c) => c.classList.toggle("activo", c.dataset.id === id));
}

/* ---------- navegación entre pestañas ---------- */

function irATab(nombre) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("activa", t.id === "tab-" + nombre));
  document.querySelectorAll(".nav-boton").forEach((b) => b.classList.toggle("activo", b.dataset.tab === nombre));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cambiarMes(n) {
  mesVisible = sumarMeses(mesVisible, n);
  pintarTodo();
}

/* ---------- editar un gasto ---------- */

let editandoGastoId = null;

function editarGasto(id) {
  const gasto = datos.gastos.find((g) => g.id === id);
  if (!gasto) return;

  editandoGastoId = id;
  irATab("gastos");
  $("#inputCantidadGasto").value = gasto.cantidad;
  $('#formGasto [name="nota"]').value = gasto.nota || "";
  $("#inputFechaGasto").value = gasto.fecha;
  marcarChip("#chipsCategoriaGasto", "#categoriaGastoElegida", gasto.categoria);

  $("#tituloGastos").textContent = "✏️ Corregir un gasto";
  $("#ayudaGastos").textContent = "Cambia lo que quieras y dale a guardar. Si te has equivocado de todo, cancela y no se toca nada.";
  $("#btnGuardarGasto").textContent = "Guardar los cambios";
  $("#btnCancelarEdicion").hidden = false;
  $("#inputCantidadGasto").focus();
}

function cancelarEdicion() {
  editandoGastoId = null;
  $("#formGasto").reset();
  $("#inputFechaGasto").value = hoyISO();
  marcarChip("#chipsCategoriaGasto", "#categoriaGastoElegida", CATEGORIAS_GASTO[0].id);
  $("#tituloGastos").textContent = "🛒 Gastos del día a día";
  $("#ayudaGastos").textContent = "Cada vez que compres algo, apúntalo aquí en 10 segundos y se descuenta solo de lo que te queda.";
  $("#btnGuardarGasto").textContent = "Apuntar gasto";
  $("#btnCancelarEdicion").hidden = true;
}

/* ==========================================================
   Cuenta: entrar, registrarse y sincronizar
   ========================================================== */

function mostrarAcceso(mostrar) {
  $("#pantallaAcceso").hidden = !mostrar;
}

function avisoAcceso(texto, esError = true) {
  const el = $("#accesoAviso");
  el.textContent = texto;
  el.hidden = !texto;
  el.classList.toggle("malo", esError);
}

async function entrarEnModoNube({ subirLoLocal = false } = {}) {
  modo = "nube";
  localStorage.setItem(CLAVE_MODO, "nube");

  try {
    if (subirLoLocal) await subirTodoLoLocal();
    await Nube.vaciarCola();
    const nube = await Nube.cargarTodo();

    datos.ingresos = nube.ingresos;
    datos.fijos = nube.fijos;
    datos.gastos = nube.gastos;
    datos.deudas = nube.deudas;
    datos.personas = nube.personas;
    if (nube.perfil) {
      datos.ajustes = {
        nombre: nube.perfil.nombre,
        emoji: nube.perfil.emoji,
        color: nube.perfil.color,
        tema: nube.perfil.tema,
        alias: nube.perfil.alias,
      };
    }
    guardarDatos();
    pintarTodo();
    Nube.escuchar(alCambiarLaNube);
  } catch (error) {
    // sin internet se sigue trabajando con lo que hay guardado aquí
    pintarTodo();
    avisar("📴 Sin internet, trabajando con lo guardado aquí");
  }
}

// lo que ya estaba apuntado sin cuenta se sube tal cual al crear la cuenta
async function subirTodoLoLocal() {
  for (const tabla of ["ingresos", "fijos", "gastos"]) {
    for (const fila of datos[tabla]) {
      const conId = { ...fila, id: esUuid(fila.id) ? fila.id : nuevoId() };
      await Nube.insertar(tabla, conId);
    }
  }
  await Nube.guardarPerfil(datos.ajustes).catch(() => {});
}

const esUuid = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);

let recargaPendiente;
function alCambiarLaNube() {
  // varios cambios seguidos, una sola recarga
  clearTimeout(recargaPendiente);
  recargaPendiente = setTimeout(async () => {
    try {
      const nube = await Nube.cargarTodo();
      datos.ingresos = nube.ingresos;
      datos.fijos = nube.fijos;
      datos.gastos = nube.gastos;
      datos.deudas = nube.deudas;
      datos.personas = nube.personas;
      guardarDatos();
      pintarTodo();
    } catch { /* ya se reintentará */ }
  }, 400);
}

/* ---------- eventos ---------- */

document.querySelectorAll(".nav-boton").forEach((boton) => {
  boton.addEventListener("click", () => irATab(boton.dataset.tab));
});

$("#btnAbrirAyuda").addEventListener("click", () => {
  irATab("ayuda");
  document.querySelectorAll(".nav-boton").forEach((b) => b.classList.remove("activo"));
});

$("#btnAyudaDesdePasos").addEventListener("click", () => {
  irATab("ayuda");
  document.querySelectorAll(".nav-boton").forEach((b) => b.classList.remove("activo"));
});

$("#btnAbrirAjustes").addEventListener("click", () => {
  irATab("ajustes");
  document.querySelectorAll(".nav-boton").forEach((b) => b.classList.remove("activo"));
});

$("#btnMesAnterior").addEventListener("click", () => cambiarMes(-1));
$("#btnMesSiguiente").addEventListener("click", () => cambiarMes(1));
$("#btnVolverHoy").addEventListener("click", () => {
  mesVisible = mesActualClave();
  pintarTodo();
});

$("#btnGastoRapido").addEventListener("click", () => {
  cancelarEdicion();
  irATab("gastos");
  $("#inputCantidadGasto").focus();
});

document.querySelectorAll("#formGasto [data-atajo]").forEach((boton) => {
  boton.addEventListener("click", () => {
    const d = new Date();
    d.setDate(d.getDate() - Number(boton.dataset.atajo));
    $("#inputFechaGasto").value = `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
  });
});

/* ---------- acceso ---------- */

let modoAcceso = "entrar";

document.querySelectorAll(".acceso-pestanas .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    modoAcceso = chip.dataset.modo;
    document.querySelectorAll(".acceso-pestanas .chip").forEach((c) => c.classList.toggle("activo", c === chip));
    $("#btnAcceso").textContent = modoAcceso === "entrar" ? "Entrar" : "Crear mi cuenta";
    $('#formAcceso [name="contrasena"]').autocomplete = modoAcceso === "entrar" ? "current-password" : "new-password";
    avisoAcceso("");
  });
});

$("#formAcceso").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const form = new FormData(evento.target);
  const correo = form.get("correo").trim();
  const contrasena = form.get("contrasena");
  const boton = $("#btnAcceso");
  boton.disabled = true;
  avisoAcceso("");

  try {
    if (modoAcceso === "registrar") {
      const { hayQueConfirmar } = await Nube.registrar(correo, contrasena);
      if (hayQueConfirmar) {
        avisoAcceso("Cuenta creada. Te hemos mandado un correo: ábrelo, pulsa el enlace y vuelve aquí a entrar.", false);
        boton.disabled = false;
        return;
      }
      await entrarEnModoNube({ subirLoLocal: true });
    } else {
      await Nube.entrar(correo, contrasena);
      await entrarEnModoNube();
    }
    mostrarAcceso(false);
    avisar("☁️ Sesión iniciada");
  } catch (error) {
    avisoAcceso(traducirErrorDeAcceso(error));
  }
  boton.disabled = false;
});

function traducirErrorDeAcceso(error) {
  const texto = (error && error.message ? error.message : String(error)).toLowerCase();
  if (texto.includes("invalid login")) return "El correo o la contraseña no son correctos.";
  if (texto.includes("already registered")) return "Ese correo ya tiene cuenta. Entra en vez de crearla.";
  if (texto.includes("email not confirmed")) return "Todavía no has confirmado la cuenta. Mira tu correo y pulsa el enlace.";
  if (texto.includes("password")) return "La contraseña debe tener al menos 6 letras o números.";
  if (texto.includes("rate limit") || texto.includes("too many")) return "Demasiados intentos seguidos. Espera un rato y vuelve a probar.";
  if (texto.includes("fetch") || texto.includes("network")) return "No hay internet. Puedes usar la app sin cuenta mientras tanto.";
  return "No se ha podido: " + (error && error.message ? error.message : "error desconocido");
}

$("#btnOlvide").addEventListener("click", async () => {
  const correo = $('#formAcceso [name="correo"]').value.trim();
  if (!correo) {
    avisoAcceso("Escribe primero tu correo aquí arriba y vuelve a tocar.");
    return;
  }
  try {
    await Nube.pedirNuevaContrasena(correo);
    avisoAcceso("Te hemos mandado un correo. Ábrelo, pulsa el enlace y podrás poner una contraseña nueva.", false);
  } catch (error) {
    avisoAcceso(traducirErrorDeAcceso(error));
  }
});

// la persona vuelve desde el enlace del correo: se le pide la contraseña nueva
Nube.alRecuperar(() => {
  mostrarAcceso(true);
  $("#formAcceso").hidden = true;
  $("#btnSinCuenta").hidden = true;
  $("#formNuevaContrasena").hidden = false;
});

$("#formNuevaContrasena").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const nueva = new FormData(evento.target).get("contrasena");
  try {
    await Nube.cambiarContrasena(nueva);
    $("#formNuevaContrasena").hidden = true;
    $("#formAcceso").hidden = false;
    $("#btnSinCuenta").hidden = false;
    await entrarEnModoNube();
    mostrarAcceso(false);
    avisar("✅ Contraseña cambiada");
  } catch (error) {
    avisoAcceso(traducirErrorDeAcceso(error));
  }
});

$("#btnSinCuenta").addEventListener("click", () => {
  modo = "local";
  localStorage.setItem(CLAVE_MODO, "local");
  mostrarAcceso(false);
  pintarTodo();
});

$("#btnEntrarDesdeAjustes").addEventListener("click", () => mostrarAcceso(true));
$("#btnCrearCuentaDesdeDeudas").addEventListener("click", () => mostrarAcceso(true));

$("#btnCerrarSesion").addEventListener("click", async () => {
  if (!confirm("¿Cerrar sesión? Tus datos siguen en la nube, y aquí se quedará solo la copia local.")) return;
  await Nube.salir();
  modo = "local";
  localStorage.setItem(CLAVE_MODO, "local");
  pintarTodo();
  avisar("Sesión cerrada");
});

$("#btnSincronizar").addEventListener("click", async () => {
  avisar("Sincronizando…");
  await Nube.vaciarCola();
  await entrarEnModoNube();
  avisar("☁️ Al día");
});

$("#btnGuardarAlias").addEventListener("click", async () => {
  const alias = $("#inputAlias").value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,24}$/.test(alias)) {
    avisar("El alias solo admite minúsculas, números, puntos y guiones (3 a 24)");
    return;
  }
  try {
    await Nube.guardarPerfil({ ...datos.ajustes, alias });
    datos.ajustes.alias = alias;
    guardarDatos();
    avisar("✅ Alias guardado: " + alias);
  } catch (error) {
    avisar(String(error.message || error).includes("duplicate") ? "Ese alias ya lo tiene otra persona" : "No se pudo guardar el alias");
  }
});

/* ---------- formularios de dinero ---------- */

$("#formIngreso").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const form = new FormData(evento.target);
  const nombre = form.get("nombre").trim();
  anadirFila("ingresos", {
    id: nuevoId(),
    nombre,
    tipo: form.get("tipo"),
    cantidad: parseFloat(form.get("cantidad")),
    dia: parseInt(form.get("dia"), 10),
    mensual: form.get("mensual") === "on",
    mes: mesVisible,
    desde: mesVisible,
  });
  evento.target.reset();
  evento.target.querySelector('[name="mensual"]').checked = true;
  marcarChip("#chipsTipoIngreso", "#tipoIngresoElegido", CATEGORIAS_INGRESO[0].id);
  avisar(`✅ Ingreso "${nombre}" guardado`);
});

$("#formFijo").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const form = new FormData(evento.target);
  const meses = parseInt(form.get("meses"), 10);
  const nombre = form.get("nombre").trim();
  anadirFila("fijos", {
    id: nuevoId(),
    nombre,
    cantidad: parseFloat(form.get("cantidad")),
    dia: parseInt(form.get("dia"), 10),
    categoria: form.get("categoria"),
    periodicidad: form.get("periodicidad"),
    fin: form.get("periodicidad") === "mensual" && meses > 0 ? sumarMeses(mesVisible, meses) : null,
    desde: mesVisible,
  });
  evento.target.reset();
  marcarChip("#chipsCategoriaFijo", "#categoriaFijoElegida", CATEGORIAS_FIJO[0].id);
  avisar(`✅ Gasto fijo "${nombre}" guardado`);
});

$("#formGasto").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const form = new FormData(evento.target);
  const cantidad = parseFloat(form.get("cantidad"));
  const categoria = form.get("categoria");
  const nota = form.get("nota").trim();
  const fecha = form.get("fecha");
  const cat = categoriaDe(CATEGORIAS_GASTO, categoria);

  if (editandoGastoId) {
    const id = editandoGastoId;
    cancelarEdicion();
    cambiarFila("gastos", id, { cantidad, categoria, nota, fecha });
    avisar(`✏️ Gasto corregido, ahora son ${dinero(cantidad)}`);
    irATab("inicio");
    return;
  }

  cancelarEdicion();
  // el mes que se mira salta al del gasto, para que no parezca que se ha perdido
  if (!fecha.startsWith(mesVisible)) mesVisible = fecha.slice(0, 7);
  anadirFila("gastos", { id: nuevoId(), cantidad, categoria, nota, fecha });
  avisar(`✅ Apuntado ${dinero(cantidad)} en ${cat.nombre}`);
  irATab("inicio");
});

$("#btnCancelarEdicion").addEventListener("click", () => {
  cancelarEdicion();
  avisar("Cambios cancelados");
});

/* ---------- deudas ---------- */

let personaElegida = null;

document.querySelectorAll("#sentidoDeuda .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#sentidoDeuda .chip").forEach((c) => c.classList.toggle("activo", c === chip));
  });
});

$("#btnBuscarPersona").addEventListener("click", async () => {
  const alias = $("#inputAliasDeuda").value.trim().toLowerCase();
  const aviso = $("#personaEncontrada");
  personaElegida = null;
  if (!alias) { aviso.textContent = "Escribe el alias de la persona."; return; }

  aviso.textContent = "Buscando…";
  try {
    const persona = await Nube.buscarPersona(alias);
    if (!persona) {
      aviso.textContent = `No hay nadie con el alias "${alias}". Pídele que lo ponga en sus ajustes.`;
      return;
    }
    personaElegida = persona;
    aviso.textContent = `✅ Encontrada: ${persona.nombre !== "Mi monedero" ? persona.nombre : persona.alias}`;
    if (!datos.personas.some((p) => p.id === persona.id)) datos.personas.push(persona);
  } catch {
    aviso.textContent = "No se ha podido buscar, mira si tienes internet.";
  }
});

$("#formDeuda").addEventListener("submit", (evento) => {
  evento.preventDefault();
  if (!Nube.hayCuenta()) return;
  if (!personaElegida) {
    avisar("Busca primero a la persona por su alias");
    return;
  }
  const form = new FormData(evento.target);
  const meDeben = $("#sentidoDeuda .chip.activo").dataset.sentido === "me-deben";
  const yo = Nube.usuario.id;

  const deuda = {
    id: nuevoId(),
    acreedor: meDeben ? yo : personaElegida.id,
    deudor: meDeben ? personaElegida.id : yo,
    concepto: form.get("concepto").trim(),
    cantidad: parseFloat(form.get("cantidad")),
    fecha: hoyISO(),
    pagada: false,
  };

  datos.deudas.unshift(deuda);
  guardarDatos();
  pintarTodo();
  Nube.insertarDeuda(deuda).then((r) => {
    if (!r.ok) avisar("📴 Apuntada aquí, se subirá cuando vuelva internet");
    pintarEstadoNube();
  });

  evento.target.reset();
  $("#personaEncontrada").textContent = "";
  personaElegida = null;
  avisar(`✅ Deuda apuntada: ${dinero(deuda.cantidad)}`);
});

/* ---------- ajustes ---------- */

$("#formAjustes").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  datos.ajustes.nombre = $("#ajusteNombre").value.trim() || "Mi monedero";
  datos.ajustes.emoji = $("#ajusteEmoji").value.trim() || "💶";
  guardarDatos();
  pintarTodo();
  if (Nube.hayCuenta()) {
    try { await Nube.guardarPerfil(datos.ajustes); } catch { avisar("Guardado aquí, la nube no respondió"); return; }
  }
  avisar("✅ Ajustes guardados");
});

document.querySelectorAll("#opcionesTema .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    datos.ajustes.tema = chip.dataset.tema;
    guardarDatos();
    pintarTodo();
    if (Nube.hayCuenta()) Nube.guardarPerfil(datos.ajustes).catch(() => {});
  });
});

$("#btnExportar").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `moneorq-copia-${hoyISO()}.json`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
  avisar("💾 Copia descargada");
});

$("#btnImportar").addEventListener("click", () => $("#inputImportar").click());

$("#inputImportar").addEventListener("change", (evento) => {
  const archivo = evento.target.files[0];
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = () => {
    try {
      const importado = JSON.parse(lector.result);
      if (!importado.ajustes || !Array.isArray(importado.gastos)) throw new Error("formato");
      datos = { ...datosPorDefecto(), ...importado, ajustes: { ...datosPorDefecto().ajustes, ...importado.ajustes } };
      datos.ingresos = datos.ingresos.map((i) => ({ tipo: "nomina", desde: null, ...i }));
      datos.fijos = datos.fijos.map((f) => ({ periodicidad: "mensual", fin: null, desde: null, ...f }));
      guardarDatos();
      pintarTodo();
      alert("✅ Copia recuperada correctamente.");
    } catch {
      alert("⚠️ Ese archivo no parece una copia de Moneorq.");
    }
    evento.target.value = "";
  };
  lector.readAsText(archivo);
});

$("#btnBorrarTodo").addEventListener("click", () => {
  if (!confirm("¿Seguro que quieres borrar TODOS los datos de este aparato? Esto no se puede deshacer.")) return;
  const ajustes = datos.ajustes;
  datos = { ...datosPorDefecto(), ajustes };
  mesVisible = mesActualClave();
  guardarDatos();
  pintarTodo();
  irATab("inicio");
});

/* ---------- vuelve el internet ---------- */

window.addEventListener("online", async () => {
  if (!Nube.hayCuenta()) return;
  const subidas = await Nube.vaciarCola();
  if (subidas) {
    avisar(`☁️ Subidos ${subidas} ${subidas === 1 ? "cambio" : "cambios"} que estaban esperando`);
    await entrarEnModoNube();
  }
  pintarEstadoNube();
});

/* ---------- arranque ---------- */

async function arrancar() {
  pintarChips("#chipsCategoriaGasto", CATEGORIAS_GASTO, "#categoriaGastoElegida");
  pintarChips("#chipsCategoriaFijo", CATEGORIAS_FIJO, "#categoriaFijoElegida");
  pintarChips("#chipsTipoIngreso", CATEGORIAS_INGRESO, "#tipoIngresoElegido");
  $("#inputFechaGasto").value = hoyISO();
  pintarTodo();

  const usuario = await Nube.recuperarSesion().catch(() => null);
  if (usuario) {
    await entrarEnModoNube();
    mostrarAcceso(false);
  } else {
    mostrarAcceso(modo !== "local");
  }
}

arrancar();
