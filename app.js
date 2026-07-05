/* ==========================================================
   Moneorq — lógica de la app
   Todos los datos viven en localStorage, en este navegador.
   ========================================================== */

const CLAVE_DATOS = "moneorq-datos";

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
  ajustes: { nombre: "Mi monedero", emoji: "💶", color: COLORES[0], tema: "auto" },
  ingresos: [],   // { id, nombre, cantidad, dia, mensual, mes }  (mes solo en puntuales: "2026-07")
  fijos: [],      // { id, nombre, cantidad, dia, categoria }
  gastos: [],     // { id, cantidad, categoria, nota, fecha }     (fecha: "2026-07-05")
});

let datos = cargarDatos();

function cargarDatos() {
  try {
    const crudo = localStorage.getItem(CLAVE_DATOS);
    if (!crudo) return datosPorDefecto();
    const guardado = JSON.parse(crudo);
    return { ...datosPorDefecto(), ...guardado, ajustes: { ...datosPorDefecto().ajustes, ...guardado.ajustes } };
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

const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const mesActualClave = () => new Date().toISOString().slice(0, 7); // "2026-07"

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function categoriaDe(lista, id) {
  return lista.find((c) => c.id === id) || lista[lista.length - 1];
}

/* ---------- cálculos del mes ---------- */

function calcularMes() {
  const mes = mesActualClave();
  const ingresosMes = datos.ingresos
    .filter((i) => i.mensual || i.mes === mes)
    .reduce((suma, i) => suma + i.cantidad, 0);
  const fijosMes = datos.fijos.reduce((suma, f) => suma + f.cantidad, 0);
  const gastosMes = datos.gastos
    .filter((g) => g.fecha.startsWith(mes))
    .reduce((suma, g) => suma + g.cantidad, 0);
  return { ingresosMes, fijosMes, gastosMes, disponible: ingresosMes - fijosMes - gastosMes };
}

/* ---------- pintado ---------- */

function pintarTodo() {
  pintarCabecera();
  pintarResumen();
  pintarMovimientos();
  pintarIngresos();
  pintarFijos();
  pintarGastos();
  pintarAjustes();
}

function pintarCabecera() {
  const { nombre, emoji, color, tema } = datos.ajustes;
  $("#monederoNombre").textContent = nombre;
  $("#monederoEmoji").textContent = emoji;
  document.documentElement.style.setProperty("--acento", color);
  document.body.dataset.tema = tema;

  const fecha = new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  $("#mesActual").textContent = fecha;

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

function pintarResumen() {
  const { ingresosMes, fijosMes, gastosMes } = calcularMes();
  $("#resumenIngresos").textContent = dinero(ingresosMes);
  $("#resumenFijos").textContent = dinero(fijosMes);
  $("#resumenGastos").textContent = dinero(gastosMes);
}

function elementoMovimiento({ emoji, nombre, detalle, cantidad, esGasto, alBorrar }) {
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
  cantidadSpan.textContent = (esGasto ? "−" : "+") + dinero(cantidad);

  li.append(icono, datosDiv, cantidadSpan);

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
  const mes = mesActualClave();
  const lista = $("#listaMovimientos");
  lista.innerHTML = "";

  const gastosMes = datos.gastos
    .filter((g) => g.fecha.startsWith(mes))
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
    }));
  }

  $("#vacioMovimientos").classList.toggle("visible", gastosMes.length === 0);
}

function pintarIngresos() {
  const lista = $("#listaIngresos");
  lista.innerHTML = "";
  for (const ingreso of datos.ingresos) {
    lista.append(elementoMovimiento({
      emoji: "📥",
      nombre: ingreso.nombre,
      detalle: ingreso.mensual ? `Cada mes, el día ${ingreso.dia}` : `Solo este mes, el día ${ingreso.dia}`,
      cantidad: ingreso.cantidad,
      esGasto: false,
      alBorrar: () => {
        if (!confirm(`¿Borrar el ingreso "${ingreso.nombre}"?`)) return;
        datos.ingresos = datos.ingresos.filter((i) => i.id !== ingreso.id);
        guardarDatos();
        pintarTodo();
      },
    }));
  }
  $("#vacioIngresos").classList.toggle("visible", datos.ingresos.length === 0);
}

function pintarFijos() {
  const lista = $("#listaFijos");
  lista.innerHTML = "";
  const ordenados = [...datos.fijos].sort((a, b) => a.dia - b.dia);
  for (const fijo of ordenados) {
    const cat = categoriaDe(CATEGORIAS_FIJO, fijo.categoria);
    lista.append(elementoMovimiento({
      emoji: cat.emoji,
      nombre: fijo.nombre,
      detalle: `${cat.nombre} · te lo cobran el día ${fijo.dia}`,
      cantidad: fijo.cantidad,
      esGasto: true,
      alBorrar: () => {
        if (!confirm(`¿Borrar el gasto fijo "${fijo.nombre}"?`)) return;
        datos.fijos = datos.fijos.filter((f) => f.id !== fijo.id);
        guardarDatos();
        pintarTodo();
      },
    }));
  }
  const total = datos.fijos.reduce((s, f) => s + f.cantidad, 0);
  $("#totalFijos").textContent = datos.fijos.length ? `Total fijo al mes: ${dinero(total)}` : "";
  $("#vacioFijos").classList.toggle("visible", datos.fijos.length === 0);
}

function pintarGastos() {
  const mes = mesActualClave();
  const lista = $("#listaGastos");
  lista.innerHTML = "";
  const gastosMes = datos.gastos
    .filter((g) => g.fecha.startsWith(mes))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  for (const gasto of gastosMes) {
    const cat = categoriaDe(CATEGORIAS_GASTO, gasto.categoria);
    lista.append(elementoMovimiento({
      emoji: cat.emoji,
      nombre: gasto.nota || cat.nombre,
      detalle: `${cat.nombre} · día ${Number(gasto.fecha.slice(8, 10))}`,
      cantidad: gasto.cantidad,
      esGasto: true,
      alBorrar: () => {
        datos.gastos = datos.gastos.filter((g) => g.id !== gasto.id);
        guardarDatos();
        pintarTodo();
      },
    }));
  }

  const total = gastosMes.reduce((s, g) => s + g.cantidad, 0);
  $("#totalGastosMes").textContent = gastosMes.length ? `Gastado este mes: ${dinero(total)}` : "";
  $("#vacioGastos").classList.toggle("visible", gastosMes.length === 0);
}

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
    });
    paleta.append(boton);
  }

  document.querySelectorAll("#opcionesTema .chip").forEach((chip) => {
    chip.classList.toggle("activo", chip.dataset.tema === datos.ajustes.tema);
  });
}

/* ---------- selects de categorías ---------- */

function rellenarSelect(select, categorias) {
  select.innerHTML = "";
  for (const cat of categorias) {
    const opcion = document.createElement("option");
    opcion.value = cat.id;
    opcion.textContent = `${cat.emoji} ${cat.nombre}`;
    select.append(opcion);
  }
}

/* ---------- navegación entre pestañas ---------- */

function irATab(nombre) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("activa", t.id === "tab-" + nombre));
  document.querySelectorAll(".nav-boton").forEach((b) => b.classList.toggle("activo", b.dataset.tab === nombre));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- eventos ---------- */

document.querySelectorAll(".nav-boton").forEach((boton) => {
  boton.addEventListener("click", () => irATab(boton.dataset.tab));
});

$("#btnGastoRapido").addEventListener("click", () => {
  irATab("gastos");
  $("#inputCantidadGasto").focus();
});

$("#formIngreso").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const form = new FormData(evento.target);
  datos.ingresos.push({
    id: nuevoId(),
    nombre: form.get("nombre").trim(),
    cantidad: parseFloat(form.get("cantidad")),
    dia: parseInt(form.get("dia"), 10),
    mensual: form.get("mensual") === "on",
    mes: mesActualClave(),
  });
  guardarDatos();
  evento.target.reset();
  evento.target.querySelector('[name="mensual"]').checked = true;
  pintarTodo();
});

$("#formFijo").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const form = new FormData(evento.target);
  datos.fijos.push({
    id: nuevoId(),
    nombre: form.get("nombre").trim(),
    cantidad: parseFloat(form.get("cantidad")),
    dia: parseInt(form.get("dia"), 10),
    categoria: form.get("categoria"),
  });
  guardarDatos();
  evento.target.reset();
  pintarTodo();
});

$("#formGasto").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const form = new FormData(evento.target);
  datos.gastos.push({
    id: nuevoId(),
    cantidad: parseFloat(form.get("cantidad")),
    categoria: form.get("categoria"),
    nota: form.get("nota").trim(),
    fecha: form.get("fecha"),
  });
  guardarDatos();
  evento.target.reset();
  evento.target.querySelector('[name="fecha"]').value = hoyISO();
  pintarTodo();
  irATab("inicio");
});

$("#formAjustes").addEventListener("submit", (evento) => {
  evento.preventDefault();
  datos.ajustes.nombre = $("#ajusteNombre").value.trim() || "Mi monedero";
  datos.ajustes.emoji = $("#ajusteEmoji").value.trim() || "💶";
  guardarDatos();
  pintarTodo();
});

document.querySelectorAll("#opcionesTema .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    datos.ajustes.tema = chip.dataset.tema;
    guardarDatos();
    pintarTodo();
  });
});

$("#btnExportar").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `moneorq-copia-${hoyISO()}.json`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
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
  if (!confirm("¿Seguro que quieres borrar TODOS los datos? Esto no se puede deshacer.")) return;
  datos = datosPorDefecto();
  guardarDatos();
  pintarTodo();
  irATab("inicio");
});

/* ---------- arranque ---------- */

rellenarSelect($("#selectCategoriaGasto"), CATEGORIAS_GASTO);
rellenarSelect($("#selectCategoriaFijo"), CATEGORIAS_FIJO);
document.querySelector('#formGasto [name="fecha"]').value = hoyISO();
pintarTodo();
