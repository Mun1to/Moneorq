# 💶 Moneorq

**Tu dinero, claro.** Una app web sencilla para saber de un vistazo cuánto te queda cada mes.

Moneorq nace de un problema muy real: hay muchas personas que ganan poco, pagan mucho y viven saturadas intentando llevar las cuentas de cabeza. Esta app quiere que apuntar un gasto cueste 10 segundos y que la pregunta *«¿cuánto me queda este mes?»* tenga siempre una respuesta clara y en grande.

👉 **[Abrir Moneorq](https://mun1to.github.io/Moneorq/)** · 📖 **[Guía para empezar](GUIA.md)**

> La guía está también **dentro de la app**, en el botón ❓ de arriba a la izquierda, porque quien la usa no entra a GitHub. Y la pantalla de inicio enseña los tres primeros pasos hasta que están hechos.

## ✨ Qué hace

- **📥 Ingresos líquidos**, apunta lo que *de verdad* te entra en la cuenta (ya con impuestos descontados) y qué día lo cobras. Mensuales (nómina, pensión) o puntuales (un plus, un trabajillo, dinero de un amigo).
- **📌 Gastos fijos y suscripciones**, alquiler o hipoteca, luz, internet, móvil, Spotify, Amazon Prime… con el día en que te los cobran, cada mes o una vez al año. Los pagos a plazos ("me quedan 3 meses del ordenador") se apagan solos cuando terminan.
- **🛒 Gastos del día a día**, un formulario rápido: cuánto, en qué y una nota opcional. Se descuenta al momento.
- **🏠 Inicio**, cuánto te queda este mes en grande, con barra de progreso y últimos movimientos.
- **📅 Calendario del mes**, todos los días con lo gastado en cada uno y una marca en los días que te pagan y en los que te cobran. Tocas un día y apuntas un gasto de ese día, aunque ya haya pasado.
- **🗓️ Todos tus meses**, te mueves con las flechas a cualquier mes, pasado o futuro, y ves su presupuesto entero. La pestaña Meses lista lo que entró, lo que se fue y lo que quedó en cada uno.
- **🤝 Deudas con otras personas**, "me debes 20 € de la cena". Las dos personas ven la misma deuda y cualquiera la marca como pagada.
- **✏️ Corregir sin miedo**, tocas cualquier gasto de la lista y lo cambias.
- **🎨 Personalizable**, nombre y emoji del monedero, color de la app y tema claro u oscuro.

## 🔐 Con cuenta o sin cuenta, tú eliges

Moneorq funciona de dos maneras y las dos son de verdad:

| | **Sin cuenta** | **Con cuenta** |
|---|---|---|
| Dónde viven tus datos | Solo en tu navegador | En tu navegador **y** en la nube |
| Se ven en varios aparatos | No | Sí, se sincroniza solo |
| Deudas con otras personas | No | Sí |
| Hace falta internet | No | Solo para sincronizar |
| Quién puede verlos | Nadie más | Solo tú |

Puedes empezar sin cuenta y crearla después: lo que ya tengas apuntado **se sube tal cual**, no se pierde nada.

**Sin internet la app sigue funcionando.** Si apuntas un gasto en el supermercado y no hay cobertura, se guarda igual y se sube solo cuando vuelve la conexión. La cabecera te dice siempre cómo estás: `☁️ Guardado en la nube`, `📴 2 cambios esperando internet` o `📱 Solo en este aparato`.

## 🛡️ Cómo se protege tu dinero

- Cada fila de la base de datos lleva su dueño y hay **seguridad por filas (RLS)** activada en todas las tablas: aunque alguien tenga la llave pública de la app, la base de datos no le deja leer ni una línea que no sea suya. Está probado con dos cuentas reales.
- La llave que va en `nube.js` es la **publicable**, está pensada para ir a la vista en el navegador. Lo que protege los datos es la RLS, no esconder esa llave.
- Para apuntar una deuda con alguien solo hace falta **su alias**, nunca su correo. Buscar un alias que no existe no devuelve nada, y no hay forma de listar usuarios.
- Solo ves el nombre de otra persona si **compartes una deuda con ella**.

## 🚀 Cómo usarla

Es una web estática: no hay nada que instalar ni que compilar.

```bash
git clone https://github.com/Mun1to/Moneorq.git
cd Moneorq
npx serve .
```

O simplemente abre `index.html` en tu navegador.

En el móvil, ábrela y añádela a la pantalla de inicio: en Chrome, menú `⋮` → *Añadir a pantalla de inicio*; en Safari, compartir → *Añadir a pantalla de inicio*. Queda con su icono, como una app más.

## 🛠️ Tecnología

HTML, CSS y JavaScript puros. Sin frameworks, sin build, sin dependencias que instalar. La única librería es `supabase-js`, que se carga desde un CDN y solo se usa si decides tener cuenta.

```
index.html    la interfaz entera
styles.css    los estilos, con el color y el tema en variables CSS
app.js        toda la lógica: cálculos, calendario, meses, deudas
nube.js       la capa de internet: cuentas, sincronización y cola sin conexión
```

La base de datos es [Supabase](https://supabase.com) (PostgreSQL). Cinco tablas: `perfiles`, `ingresos`, `fijos`, `gastos` y `deudas`.

## 🗺️ Metas

- [x] 🥉 MVP: ingresos, fijos, gastos y saldo del mes
- [x] 🥈 Calendario, historial de meses y presupuesto de meses pasados
- [x] 🥇 Cuentas, sincronización entre aparatos y deudas compartidas
- [ ] 🏆 PWA instalable, avisos de "hoy te cobran X" y huchas de ahorro

## 📄 Licencia

MIT, úsala, cópiala y mejórala.
