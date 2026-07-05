# 💶 Moneorq

**Tu dinero, claro.** Una app web sencilla para saber de un vistazo cuánto te queda cada mes.

Moneorq nace de un problema muy real: hay muchas personas que ganan poco, pagan mucho y viven saturadas intentando llevar las cuentas de cabeza. Esta app quiere que apuntar un gasto cueste 10 segundos y que la pregunta *«¿cuánto me queda este mes?»* tenga siempre una respuesta clara y en grande.

## ✨ Qué hace

- **📥 Ingresos líquidos** — apunta lo que *de verdad* te entra en la cuenta (ya con impuestos descontados) y qué día lo cobras. Mensuales (nómina, pensión) o puntuales.
- **📌 Gastos fijos y suscripciones** — alquiler o hipoteca, luz, internet, móvil, Spotify, Amazon Prime… con el día en que te los cobran, cada mes o una vez al año. Los pagos a plazos ("me quedan 3 meses del ordenador") se apagan solos cuando terminan.
- **🛒 Gastos del día a día** — un formulario rápido: cuánto, en qué (supermercado, transporte, ocio…) y una nota opcional. Se descuenta al momento.
- **🏠 Inicio** — cuánto te queda este mes en grande, con barra de progreso y últimos movimientos.
- **🎨 Personalizable** — nombre y emoji del monedero, color de la app y tema claro/oscuro.
- **💾 Tus datos son tuyos** — todo se guarda en tu navegador (localStorage). Sin cuentas, sin servidores, sin que nadie vea tus finanzas. Puedes descargar y recuperar una copia de seguridad en JSON.

## 🚀 Cómo usarla

Es una web estática: no hay nada que instalar.

```bash
git clone https://github.com/Mun1to/Moneorq.git
cd Moneorq
# ábrela con cualquier servidor estático, por ejemplo:
npx serve .
```

O simplemente abre `index.html` en tu navegador.

## 🛠️ Tecnología

HTML, CSS y JavaScript puros. Sin frameworks, sin dependencias, sin build. Así cualquiera puede leer el código y aprender de él.

## 🗺️ Metas

- [x] 🥉 MVP: ingresos, fijos, gastos y saldo del mes
- [ ] 🥈 Historial de meses anteriores y gráficas sencillas
- [ ] 🥇 Avisos de "hoy te cobran X" y modo huchas/ahorro
- [ ] 🏆 PWA instalable en el móvil

## 📄 Licencia

MIT — úsala, cópiala y mejórala.
