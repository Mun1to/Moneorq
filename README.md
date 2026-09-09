# 💶 Moneorq

**Tu dinero, claro.** Una app web sencilla para saber de un vistazo cuánto te queda cada mes.

Moneorq nace de un problema muy real: hay muchas personas que ganan poco, pagan mucho y viven saturadas intentando llevar las cuentas de cabeza. Esta app quiere que apuntar un gasto cueste 10 segundos y que la pregunta *«¿cuánto me queda este mes?»* tenga siempre una respuesta clara y en grande.

## ✨ Qué hace

- **📥 Ingresos líquidos** — apunta lo que *de verdad* te entra en la cuenta (ya con impuestos descontados) y qué día lo cobras. Mensuales (nómina, pensión) o puntuales.
- **📌 Gastos fijos y suscripciones** — alquiler o hipoteca, luz, internet, móvil, Spotify, Amazon Prime… con el día en que te los cobran, cada mes o una vez al año. Los pagos a plazos ("me quedan 3 meses del ordenador") se apagan solos cuando terminan.
- **🛒 Gastos del día a día** — un formulario rápido: cuánto, en qué (supermercado, transporte, ocio…) y una nota opcional. Se descuenta al momento.
- **🏠 Inicio** — cuánto te queda este mes en grande, con barra de progreso y últimos movimientos.
- **📅 Calendario del mes** — todos los días del mes con lo gastado en cada uno y una marca en los días que te pagan y en los que te cobran. Tocas un día y apuntas un gasto de ese día, aunque ya haya pasado.
- **🗓️ Todos tus meses** — te mueves con las flechas a cualquier mes, pasado o futuro, y ves el presupuesto de ese mes entero. La pestaña Meses lista lo que entró, lo que se fue y lo que quedó en cada uno.
- **✏️ Corregir sin miedo** — tocas cualquier gasto de la lista y lo cambias, sin borrarlo y volver a escribirlo.
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

## 🔍 No te fíes, compruébalo

Que el código sea abierto solo sirve si alguien lo lee, y casi nadie lo hace. Así que en vez
de pedirte que confíes, aquí tienes cómo comprobarlo: pon a tu propia IA a revisar este
repositorio y te dará un informe de seguridad en unos minutos, aunque no sepas programar.

Abre [AI-AUDIT.md](AI-AUDIT.md) y pega ese texto en Claude Code, Codex, Cursor, Copilot o la
que uses. Te dirá qué hace este programa de verdad: qué envía por internet (aquí, nada: tus
datos se quedan en tu navegador), qué toca en tu ordenador y qué ejecuta al abrirse. Es el
mismo texto en todos los repositorios públicos de aquí, así que puedes comparar.

## 📄 Licencia

MIT — úsala, cópiala y mejórala.
