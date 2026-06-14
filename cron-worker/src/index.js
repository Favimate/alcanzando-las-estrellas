// Worker programado — Envío automático de notificaciones WhatsApp
// Se ejecuta diariamente a las 12:00 UTC (09:00 Chile aprox.)
// Importa la lógica de notificaciones desde la función de Pages

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

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

async function procesarNotificaciones(env) {
  const cfgRows = await env.DB.prepare('SELECT clave, valor FROM config').all();
  const cfg = Object.fromEntries(cfgRows.results.map(r => [r.clave, r.valor]));

  if (cfg.notificaciones_activas !== '1') {
    console.log('Notificaciones desactivadas — saliendo.');
    return;
  }

  const diaVenc = parseInt(cfg.dia_vencimiento || '5');
  const now = new Date();
  const hoy = now.getDate();
  const mes  = now.getMonth() + 1;
  const año  = now.getFullYear();

  console.log(`Revisando: hoy=${hoy}, diaVenc=${diaVenc}, mes=${MESES[mes]} ${año}`);

  let tipo = null;
  if (hoy === diaVenc - 3) tipo = 'recordatorio';
  else if (hoy === diaVenc)     tipo = 'vencimiento';
  else if (hoy === diaVenc + 3) tipo = 'deuda';

  if (!tipo) {
    console.log('No hay notificaciones que enviar hoy.');
    return;
  }

  console.log(`Enviando notificaciones tipo: ${tipo}`);

  const { results: alumnas } = await env.DB.prepare(`
    SELECT a.id, a.nombre, a.telefono, a.monto
    FROM alumnas a
    LEFT JOIN pagos p ON p.alumna_id=a.id AND p.mes=? AND p.año=?
    WHERE a.activa=1 AND (p.estado IS NULL OR p.estado='pendiente')
  `).bind(mes, año).all();

  console.log(`Alumnas con pago pendiente: ${alumnas.length}`);

  let enviados = 0, errores = 0;

  for (const a of alumnas) {
    const nombre    = a.nombre.split(' ')[0];
    const montoFmt  = Number(a.monto).toLocaleString('es-CL');
    let msg = '';

    if (tipo === 'recordatorio') {
      msg = `Hola ${nombre}! 👋 Te recordamos que tu mensualidad de *Alcanzando las Estrellas* vence en 3 días (día ${diaVenc}). Monto: $${montoFmt}. ¡Gracias! ⭐`;
    } else if (tipo === 'vencimiento') {
      msg = `Hola ${nombre}! Hoy vence tu mensualidad de *Alcanzando las Estrellas* por $${montoFmt}. Puedes coordinar el pago con nosotros. 🌟`;
    } else if (tipo === 'deuda') {
      msg = `Hola ${nombre}. Notamos que tienes pendiente tu mensualidad de ${MESES[mes]} por $${montoFmt} en *Alcanzando las Estrellas*. Por favor contáctanos para regularizar. ⭐`;
    }

    await new Promise(r => setTimeout(r, 120)); // evitar rate limit Twilio
    const result = await sendWhatsApp(env, a.telefono, msg);

    if (result.ok) {
      enviados++;
      console.log(`✓ Enviado a ${a.nombre} (${a.telefono})`);
    } else {
      errores++;
      console.error(`✗ Error enviando a ${a.nombre}: ${result.error}`);
    }
  }

  console.log(`Resumen: ${enviados} enviados, ${errores} errores.`);
}

export default {
  // Cron: todos los días a las 12:00 UTC (09:00 Chile aprox.)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(procesarNotificaciones(env));
  },

  // HTTP handler para pruebas manuales (protegido con secret)
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/trigger' && request.method === 'POST') {
      const auth = request.headers.get('X-Secret') || '';
      if (auth !== env.CRON_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      await procesarNotificaciones(env);
      return new Response('OK', { status: 200 });
    }
    return new Response('Not found', { status: 404 });
  },
};
