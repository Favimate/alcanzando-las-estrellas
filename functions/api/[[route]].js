// API principal — Academia Alcanzando las Estrellas
// Maneja todas las rutas /api/*

const PLANES = {
  1: { nombre: '1 clase/semana',  monto: 45000 },
  2: { nombre: '2 clases/semana', monto: 55000 },
  3: { nombre: '3 clases/semana', monto: 65000 },
};

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ─── JWT helpers ────────────────────────────────────────────────────────────

function b64url(input) {
  const str = input instanceof ArrayBuffer
    ? String.fromCharCode(...new Uint8Array(input))
    : String(input);
  return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

function fromB64url(str) {
  str = str.replace(/-/g,'+').replace(/_/g,'/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function createJWT(payload, secret) {
  const enc = new TextEncoder();
  const header = b64url(JSON.stringify({ alg:'HS256', typ:'JWT' }));
  const body   = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name:'HMAC', hash:'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(sig)}`;
}

async function verifyJWT(token, secret) {
  try {
    const [header, body, sig] = token.split('.');
    if (!header || !body || !sig) return null;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name:'HMAC', hash:'SHA-256' }, false, ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC', key,
      fromB64url(sig),
      enc.encode(`${header}.${body}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ─── Response helpers ────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
const err = (msg, status = 400) => json({ error: msg }, status);

// ─── Auth middleware ─────────────────────────────────────────────────────────

async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  return verifyJWT(token, env.JWT_SECRET);
}

// ─── WhatsApp via Twilio ─────────────────────────────────────────────────────

async function sendWhatsApp(env, to, message) {
  let phone = to.replace(/\s/g,'').replace(/^0/,'');
  if (phone.startsWith('+')) phone = phone.slice(1);
  if (!phone.startsWith('56')) phone = '56' + phone;

  const body = new URLSearchParams({
    From: env.TWILIO_WHATSAPP_FROM,
    To:   `whatsapp:+${phone}`,
    Body: message,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  );

  if (res.ok) return { ok: true };
  const errData = await res.json().catch(() => ({}));
  return { ok: false, error: errData.message || 'Error Twilio' };
}

export async function enviarNotificaciones(env, tipoForzado = null) {
  const cfgRows = await env.DB.prepare('SELECT clave, valor FROM config').all();
  const cfg = Object.fromEntries(cfgRows.results.map(r => [r.clave, r.valor]));

  if (cfg.notificaciones_activas !== '1' && !tipoForzado) {
    return { skipped: true, reason: 'Notificaciones desactivadas' };
  }

  const diaVenc = parseInt(cfg.dia_vencimiento || '5');
  const now = new Date();
  const hoy = now.getDate();
  const mes = now.getMonth() + 1;
  const año = now.getFullYear();

  const enviados = [];
  const errores  = [];

  async function enviarATodaDeudora(tipo) {
    const { results } = await env.DB.prepare(`
      SELECT a.id, a.nombre, a.telefono, a.monto
      FROM alumnas a
      LEFT JOIN pagos p ON p.alumna_id = a.id AND p.mes = ? AND p.año = ?
      WHERE a.activa = 1 AND (p.estado IS NULL OR p.estado = 'pendiente')
    `).bind(mes, año).all();

    for (const a of results) {
      const nombre = a.nombre.split(' ')[0];
      const montoFmt = Number(a.monto).toLocaleString('es-CL');
      let msg = '';

      if (tipo === 'recordatorio') {
        msg = `Hola ${nombre}! 👋 Te recordamos que tu mensualidad de *Alcanzando las Estrellas* vence en 3 días (día ${diaVenc}). Monto: $${montoFmt}. ¡Gracias! ⭐`;
      } else if (tipo === 'vencimiento') {
        msg = `Hola ${nombre}! Hoy vence tu mensualidad de *Alcanzando las Estrellas* por $${montoFmt}. Puedes coordinar el pago con nosotros. 🌟`;
      } else if (tipo === 'deuda') {
        msg = `Hola ${nombre}. Notamos que tienes pendiente tu mensualidad de ${MESES[mes]} por $${montoFmt} en *Alcanzando las Estrellas*. Por favor contáctanos para regularizar. ¡Gracias! ⭐`;
      }

      if (!msg) continue;

      await new Promise(r => setTimeout(r, 100)); // evitar rate limit
      const r = await sendWhatsApp(env, a.telefono, msg);
      if (r.ok) enviados.push(a.nombre);
      else errores.push({ nombre: a.nombre, error: r.error });
    }
  }

  // Determinar qué tipo corresponde hoy (o forzar)
  if (tipoForzado) {
    await enviarATodaDeudora(tipoForzado);
  } else {
    if (hoy === diaVenc - 3) await enviarATodaDeudora('recordatorio');
    if (hoy === diaVenc)     await enviarATodaDeudora('vencimiento');
    if (hoy === diaVenc + 3) await enviarATodaDeudora('deuda');
  }

  return { enviados, errores, total: enviados.length };
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function onRequest({ request, env, params }) {
  const url     = new URL(request.url);
  const method  = request.method;
  const segments = (params.route || []);  // rutas después de /api/
  const ruta    = segments[0] || '';
  const id      = segments[1] || '';
  const sub     = segments[2] || '';

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
    });
  }

  // ── Login (público) ────────────────────────────────────────────────────────
  if (ruta === 'login' && method === 'POST') {
    const { username, password } = await request.json().catch(() => ({}));
    if (username !== env.ADMIN_USER || password !== env.ADMIN_PASS) {
      return err('Credenciales incorrectas', 401);
    }
    const token = await createJWT(
      { sub: username, exp: Math.floor(Date.now() / 1000) + 86400 * 7 },
      env.JWT_SECRET
    );
    return json({ token });
  }

  // ── Rutas protegidas ───────────────────────────────────────────────────────
  const user = await requireAuth(request, env);
  if (!user) return err('No autorizado', 401);

  // ── Dashboard ──────────────────────────────────────────────────────────────
  if (ruta === 'dashboard' && method === 'GET') {
    const now = new Date();
    const mes = now.getMonth() + 1;
    const año = now.getFullYear();

    const [totales, cfgRows] = await Promise.all([
      env.DB.prepare(`
        SELECT
          (SELECT COUNT(*) FROM alumnas WHERE activa = 1) AS total_alumnas,
          (SELECT COALESCE(SUM(CASE WHEN p.estado='pagado' THEN 1 ELSE 0 END),0)
           FROM alumnas a LEFT JOIN pagos p ON p.alumna_id=a.id AND p.mes=? AND p.año=?
           WHERE a.activa=1) AS pagadas,
          (SELECT COUNT(*) FROM alumnas a
           LEFT JOIN pagos p ON p.alumna_id=a.id AND p.mes=? AND p.año=?
           WHERE a.activa=1 AND (p.estado IS NULL OR p.estado='pendiente')) AS pendientes,
          (SELECT COALESCE(SUM(a.monto),0)
           FROM alumnas a LEFT JOIN pagos p ON p.alumna_id=a.id AND p.mes=? AND p.año=?
           WHERE a.activa=1 AND (p.estado IS NULL OR p.estado='pendiente')) AS deuda_total
      `).bind(mes, año, mes, año, mes, año).first(),
      env.DB.prepare('SELECT clave, valor FROM config').all(),
    ]);

    const cfg = Object.fromEntries(cfgRows.results.map(r => [r.clave, r.valor]));
    return json({ ...totales, mes, año, nombre_mes: MESES[mes], config: cfg });
  }

  // ── Alumnas ────────────────────────────────────────────────────────────────
  if (ruta === 'alumnas') {
    if (method === 'GET' && !id) {
      const soloActivas = url.searchParams.get('activas') !== 'false';
      const { results } = await env.DB.prepare(
        `SELECT * FROM alumnas ${soloActivas ? 'WHERE activa=1' : ''} ORDER BY nombre ASC`
      ).all();
      return json(results);
    }

    if (method === 'POST') {
      const { nombre, telefono, plan, fecha_ingreso, notas } = await request.json().catch(() => ({}));
      if (!nombre || !telefono || !plan || !fecha_ingreso) return err('Faltan campos requeridos');
      const monto = PLANES[plan]?.monto;
      if (!monto) return err('Plan inválido');

      const { meta } = await env.DB.prepare(`
        INSERT INTO alumnas (nombre, telefono, plan, monto, fecha_ingreso, notas)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(nombre.trim(), telefono.trim(), Number(plan), monto, fecha_ingreso, notas || '').run();

      return json({ id: meta.last_row_id, success: true }, 201);
    }

    if (method === 'PUT' && id) {
      const { nombre, telefono, plan, fecha_ingreso, activa, notas } = await request.json().catch(() => ({}));
      const monto = PLANES[plan]?.monto;
      if (!monto) return err('Plan inválido');

      await env.DB.prepare(`
        UPDATE alumnas SET nombre=?, telefono=?, plan=?, monto=?, fecha_ingreso=?, activa=?, notas=?
        WHERE id=?
      `).bind(nombre.trim(), telefono.trim(), Number(plan), monto, fecha_ingreso, activa ? 1 : 0, notas || '', id).run();

      return json({ success: true });
    }

    if (method === 'DELETE' && id) {
      await env.DB.prepare('UPDATE alumnas SET activa=0 WHERE id=?').bind(id).run();
      return json({ success: true });
    }
  }

  // ── Pagos ──────────────────────────────────────────────────────────────────
  if (ruta === 'pagos') {
    if (method === 'GET') {
      const mes = url.searchParams.get('mes') || (new Date().getMonth() + 1);
      const año = url.searchParams.get('año') || new Date().getFullYear();

      const { results } = await env.DB.prepare(`
        SELECT
          a.id, a.nombre, a.telefono, a.plan, a.monto AS monto_plan,
          p.id AS pago_id, p.estado, p.fecha_pago, p.monto AS monto_pagado
        FROM alumnas a
        LEFT JOIN pagos p ON p.alumna_id=a.id AND p.mes=? AND p.año=?
        WHERE a.activa=1
        ORDER BY a.nombre ASC
      `).bind(Number(mes), Number(año)).all();

      return json(results);
    }

    if (method === 'POST') {
      const { alumna_id, mes, año, estado } = await request.json().catch(() => ({}));
      if (!alumna_id || !mes || !año || !estado) return err('Faltan campos');

      const alumna = await env.DB.prepare('SELECT monto FROM alumnas WHERE id=?').bind(alumna_id).first();
      if (!alumna) return err('Alumna no encontrada', 404);

      const fechaPago = estado === 'pagado' ? new Date().toISOString().split('T')[0] : null;

      await env.DB.prepare(`
        INSERT INTO pagos (alumna_id, mes, año, estado, monto, fecha_pago)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(alumna_id, mes, año) DO UPDATE SET
          estado=excluded.estado,
          fecha_pago=excluded.fecha_pago,
          monto=excluded.monto
      `).bind(alumna_id, Number(mes), Number(año), estado, alumna.monto, fechaPago).run();

      return json({ success: true });
    }

    if (method === 'DELETE' && id) {
      await env.DB.prepare('DELETE FROM pagos WHERE id=?').bind(id).run();
      return json({ success: true });
    }
  }

  // ── Config ─────────────────────────────────────────────────────────────────
  if (ruta === 'config') {
    if (method === 'GET') {
      const { results } = await env.DB.prepare('SELECT clave, valor FROM config').all();
      return json(Object.fromEntries(results.map(r => [r.clave, r.valor])));
    }

    if (method === 'PUT') {
      const data = await request.json().catch(() => ({}));
      for (const [clave, valor] of Object.entries(data)) {
        await env.DB.prepare(`
          INSERT INTO config (clave, valor) VALUES (?, ?)
          ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor
        `).bind(clave, String(valor)).run();
      }
      return json({ success: true });
    }
  }

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  if (ruta === 'whatsapp') {
    if (method === 'POST') {
      const { tipo } = await request.json().catch(() => ({}));
      const resultado = await enviarNotificaciones(env, tipo || null);
      return json(resultado);
    }
  }

  return err('Ruta no encontrada', 404);
}
