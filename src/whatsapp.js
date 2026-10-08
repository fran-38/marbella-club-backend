// Node.js 22.x
// Puente WhatsApp: Twilio -> este backend -> Voiceflow (Dialog API) -> Twilio

const express = require("express");

const router = express.Router();

const VF_BASE = "https://general-runtime.voiceflow.com";
const iniciados = new Set();
const colas = new Map();

function configuracion() {
  return {
    vfKey: process.env.VOICEFLOW_API_KEY,
    vfVersion: process.env.VOICEFLOW_VERSION || "development",
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_WHATSAPP_FROM,
  };
}

async function interactuar(userId, action) {
  const cfg = configuracion();
  const res = await fetch(
    `${VF_BASE}/state/user/${encodeURIComponent(userId)}/interact`,
    {
      method: "POST",
      headers: {
        Authorization: cfg.vfKey,
        versionID: cfg.vfVersion,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, config: { tts: false, stripSSML: true } }),
    }
  );
  if (!res.ok) {
    throw new Error(`Voiceflow respondio ${res.status}`);
  }
  return res.json();
}

async function reiniciarSesion(userId) {
  const cfg = configuracion();
  await fetch(`${VF_BASE}/state/user/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: { Authorization: cfg.vfKey, versionID: cfg.vfVersion },
  });
  iniciados.delete(userId);
}

function extraerTextos(traces) {
  return traces
    .filter((t) => t.type === "text" && t.payload && t.payload.message)
    .map((t) => t.payload.message.trim())
    .filter(Boolean);
}

async function enviarWhatsApp(to, body) {
  const cfg = configuracion();
  const auth = Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64");
  const form = new URLSearchParams({ From: cfg.from, To: to, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    }
  );
  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`Twilio respondio ${res.status}: ${detalle}`);
  }
}

async function procesarMensaje(from, texto) {
  if (!iniciados.has(from)) {
    await interactuar(from, { type: "launch" });
    iniciados.add(from);
  }

  const traces = await interactuar(from, { type: "text", payload: texto });
  const textos = extraerTextos(traces);
  const terminada = traces.some((t) => t.type === "end");

  if (textos.length === 0) {
    textos.push("Disculpa, no te entendi. Me lo repites?");
  }
  await enviarWhatsApp(from, textos.join("\n\n"));

  if (terminada) {
    await reiniciarSesion(from);
  }
}

function encolar(from, texto) {
  const previa = colas.get(from) || Promise.resolve();
  const siguiente = previa
    .then(() => procesarMensaje(from, texto))
    .catch(async (err) => {
      console.error("[WhatsApp] Error procesando mensaje:", err.message);
      try {
        await enviarWhatsApp(
          from,
          "Tuvimos un problema tecnico. Intenta de nuevo en un momento."
        );
      } catch (e) {
        console.error("[WhatsApp] No se pudo avisar el error:", e.message);
      }
    });
  colas.set(from, siguiente);
  siguiente.finally(() => {
    if (colas.get(from) === siguiente) colas.delete(from);
  });
}

router.post("/", express.urlencoded({ extended: false }), (req, res) => {
  const from = req.body.From;
  const texto = (req.body.Body || "").trim();

  res.type("text/xml").send("<Response></Response>");

  if (!from || !texto) return;

  const cfg = configuracion();
  if (!cfg.vfKey || !cfg.sid || !cfg.token || !cfg.from) {
    console.error("[WhatsApp] Faltan variables de entorno (Voiceflow o Twilio).");
    return;
  }

  encolar(from, texto);
});

module.exports = router;
