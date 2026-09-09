/* ==========================================================
   Moneorq, la parte que vive en internet

   Sin cuenta, la app funciona igual que siempre y nada sale del navegador.
   Con cuenta, cada cosa que apuntas se guarda también en la nube y aparece
   sola en los demás aparatos.

   La llave de aquí abajo es la PÚBLICA: está pensada para ir a la vista en el
   navegador. Lo que protege el dinero de cada uno es la seguridad por filas
   de la base de datos, no esconder esta llave.
   ========================================================== */

const NUBE_URL = "https://czdnavsaswyjsdmkuhdu.supabase.co";
const NUBE_LLAVE = "sb_publishable_GPrt6QRF_aiF9A9UnW9stw_CngLbAHV";

const CLAVE_PENDIENTES = "moneorq-pendientes";

const Nube = {
  cliente: null,
  usuario: null,
  perfil: null,
  canal: null,

  /* ---------- arranque y sesión ---------- */

  disponible() {
    return typeof window.supabase !== "undefined" && window.supabase.createClient;
  },

  iniciar() {
    if (this.cliente) return true;
    if (!this.disponible()) return false;
    this.cliente = window.supabase.createClient(NUBE_URL, NUBE_LLAVE, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    return true;
  },

  async recuperarSesion() {
    if (!this.iniciar()) return null;
    const { data } = await this.cliente.auth.getSession();
    this.usuario = data.session ? data.session.user : null;
    return this.usuario;
  },

  async registrar(correo, contrasena) {
    if (!this.iniciar()) throw new Error("sin conexión con la nube");
    const { data, error } = await this.cliente.auth.signUp({ email: correo, password: contrasena });
    if (error) throw error;
    // si el proyecto pide confirmar por correo, aún no hay sesión
    this.usuario = data.session ? data.user : null;
    return { usuario: data.user, hayQueConfirmar: !data.session };
  },

  async entrar(correo, contrasena) {
    if (!this.iniciar()) throw new Error("sin conexión con la nube");
    const { data, error } = await this.cliente.auth.signInWithPassword({ email: correo, password: contrasena });
    if (error) throw error;
    this.usuario = data.user;
    return data.user;
  },

  // manda un correo con un enlace para poner una contraseña nueva
  async pedirNuevaContrasena(correo) {
    if (!this.iniciar()) throw new Error("sin conexión con la nube");
    const { error } = await this.cliente.auth.resetPasswordForEmail(correo, {
      redirectTo: location.origin + location.pathname,
    });
    if (error) throw error;
  },

  async cambiarContrasena(nueva) {
    const { error } = await this.cliente.auth.updateUser({ password: nueva });
    if (error) throw error;
  },

  // avisa cuando la persona vuelve desde el enlace del correo
  alRecuperar(callback) {
    if (!this.iniciar()) return;
    this.cliente.auth.onAuthStateChange((evento, sesion) => {
      if (evento === "PASSWORD_RECOVERY") {
        this.usuario = sesion ? sesion.user : null;
        callback();
      }
    });
  },

  async salir() {
    if (!this.cliente) return;
    await this.dejarDeEscuchar();
    await this.cliente.auth.signOut();
    this.usuario = null;
    this.perfil = null;
  },

  hayCuenta() {
    return Boolean(this.usuario);
  },

  /* ---------- leer y escribir ---------- */

  async cargarTodo() {
    const uid = this.usuario.id;
    const [perfil, ingresos, fijos, gastos, deudas, perfiles] = await Promise.all([
      this.cliente.from("perfiles").select("*").eq("id", uid).maybeSingle(),
      this.cliente.from("ingresos").select("*").eq("usuario", uid),
      this.cliente.from("fijos").select("*").eq("usuario", uid),
      this.cliente.from("gastos").select("*").eq("usuario", uid),
      this.cliente.from("deudas").select("*").order("creado", { ascending: false }),
      this.cliente.from("perfiles").select("id,nombre,alias"),
    ]);

    const fallo = [perfil, ingresos, fijos, gastos, deudas, perfiles].find((r) => r.error);
    if (fallo) throw fallo.error;

    this.perfil = perfil.data;

    return {
      perfil: perfil.data,
      ingresos: (ingresos.data || []).map(limpiarFila),
      fijos: (fijos.data || []).map(limpiarFila),
      gastos: (gastos.data || []).map(limpiarFila),
      deudas: (deudas.data || []).map((d) => ({ ...d, cantidad: Number(d.cantidad) })),
      personas: perfiles.data || [],
    };
  },

  async guardarPerfil(ajustes) {
    if (!this.hayCuenta()) return;
    const cambios = {
      nombre: ajustes.nombre,
      emoji: ajustes.emoji,
      color: ajustes.color,
      tema: ajustes.tema,
    };
    if (ajustes.alias) cambios.alias = ajustes.alias;
    const { error } = await this.cliente.from("perfiles").update(cambios).eq("id", this.usuario.id);
    if (error) throw error;
  },

  async buscarPersona(alias) {
    const { data, error } = await this.cliente.rpc("buscar_persona", { p_alias: alias });
    if (error) throw error;
    return data && data.length ? data[0] : null;
  },

  /* ---------- escrituras con cola para cuando no hay internet ---------- */

  async insertar(tabla, fila) {
    return this.escribir({ tipo: "insertar", tabla, fila: { ...fila, usuario: this.usuario.id } });
  },

  async insertarDeuda(fila) {
    return this.escribir({ tipo: "insertar", tabla: "deudas", fila });
  },

  async actualizar(tabla, id, cambios) {
    return this.escribir({ tipo: "actualizar", tabla, id, cambios });
  },

  async borrar(tabla, id) {
    return this.escribir({ tipo: "borrar", tabla, id });
  },

  async escribir(operacion) {
    if (!this.hayCuenta()) return { ok: true, local: true };
    try {
      await this.ejecutar(operacion);
      return { ok: true };
    } catch (error) {
      // sin cobertura en el supermercado: se guarda y se sube luego
      this.encolar(operacion);
      return { ok: false, encolada: true, error };
    }
  },

  async ejecutar(op) {
    let respuesta;
    if (op.tipo === "insertar") {
      respuesta = await this.cliente.from(op.tabla).upsert(op.fila, { onConflict: "id" });
    } else if (op.tipo === "actualizar") {
      respuesta = await this.cliente.from(op.tabla).update(op.cambios).eq("id", op.id);
    } else {
      respuesta = await this.cliente.from(op.tabla).delete().eq("id", op.id);
    }
    if (respuesta.error) throw respuesta.error;
  },

  encolar(operacion) {
    const cola = this.cola();
    cola.push(operacion);
    localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(cola));
  },

  cola() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_PENDIENTES)) || [];
    } catch {
      return [];
    }
  },

  // devuelve cuántas subió; las que fallan se quedan esperando otra vez
  async vaciarCola() {
    if (!this.hayCuenta()) return 0;
    const cola = this.cola();
    if (!cola.length) return 0;

    const quedan = [];
    let subidas = 0;
    for (const operacion of cola) {
      try {
        await this.ejecutar(operacion);
        subidas++;
      } catch {
        quedan.push(operacion);
      }
    }
    localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(quedan));
    return subidas;
  },

  /* ---------- tiempo real ---------- */

  escuchar(alCambiar) {
    if (!this.hayCuenta() || this.canal) return;
    this.canal = this.cliente.channel("moneorq-" + this.usuario.id);
    for (const tabla of ["gastos", "ingresos", "fijos", "deudas"]) {
      this.canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, alCambiar);
    }
    this.canal.subscribe();
  },

  async dejarDeEscuchar() {
    if (!this.canal) return;
    await this.cliente.removeChannel(this.canal);
    this.canal = null;
  },
};

// las filas de la nube traen columnas que la app local no usa
function limpiarFila(fila) {
  const { usuario, creado, ...resto } = fila;
  return { ...resto, cantidad: Number(resto.cantidad) };
}
