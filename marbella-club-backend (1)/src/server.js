// Node.js 22.x
// Servidor Express: bridge server que Voiceflow (via API step / integration)
// llama para resolver consultas de menu con RAG y para registrar pedidos
// reales en SQLite.
//
// Este es el componente donde vive la ingenieria propia del proyecto:
// Twilio recibe el mensaje de WhatsApp -> Voiceflow orquesta la charla ->
// Voiceflow llama a este backend -> este backend hace busqueda semantica (RAG)
// sobre el menu real y persiste el pedido en la base de datos -> la respuesta
// vuelve a Voiceflow -> Voiceflow responde al cliente por WhatsApp via Twilio.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const { initRag, buscarEnMenu, getMenuCompleto } = require("./ragEngine");
const {
  initSchema,
  crearPedido,
  agregarItem,
  getPedido,
  actualizarEstado,
  listarPedidos,
} = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// ---------------------------------------------------------------------------
// Salud del servicio
// ---------------------------------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok", servicio: "marbella-club-backend" });
});

// ---------------------------------------------------------------------------
// RAG: busqueda semantica sobre el menu real
// POST /rag/query   { "consulta": "algo picante de mariscos", "topK": 3 }
// ---------------------------------------------------------------------------
app.post("/rag/query", async (req, res) => {
  try {
    const { consulta, topK } = req.body;
    if (!consulta || typeof consulta !== "string") {
      return res.status(400).json({ error: "Falta el campo 'consulta' (string)." });
    }
    const resultados = await buscarEnMenu(consulta, topK || 3);
    res.json({
      consulta,
      resultados: resultados.map((r) => ({
        ...r.item,
        similitud: Number(r.score.toFixed(4)),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno en la busqueda RAG." });
  }
});

// Menu completo (para mostrar la carta sin pasar por RAG)
app.get("/menu", (req, res) => {
  res.json({ menu: getMenuCompleto() });
});

// ---------------------------------------------------------------------------
// Pedidos
// POST /pedidos                { "clienteWhatsapp": "+51...", "clienteNombre": "..." }
// POST /pedidos/:id/items      { "itemId": "cev003", "nombre": "...", "cantidad": 2, "precioUnitario": 25.00 }
// GET  /pedidos/:id
// PUT  /pedidos/:id/estado     { "estado": "confirmado" }
// GET  /pedidos?estado=en_proceso
// ---------------------------------------------------------------------------
app.post("/pedidos", (req, res) => {
  try {
    const { clienteWhatsapp, clienteNombre } = req.body;
    if (!clienteWhatsapp) {
      return res.status(400).json({ error: "Falta 'clienteWhatsapp'." });
    }
    const pedidoId = crearPedido(clienteWhatsapp, clienteNombre || null);
    res.status(201).json(getPedido(pedidoId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear el pedido." });
  }
});

app.post("/pedidos/:id/items", (req, res) => {
  try {
    const pedidoId = Number(req.params.id);
    const { itemId, nombre, cantidad, precioUnitario } = req.body;
    if (!itemId || !nombre || !cantidad || !precioUnitario) {
      return res.status(400).json({
        error: "Faltan campos: itemId, nombre, cantidad, precioUnitario son requeridos.",
      });
    }
    agregarItem(pedidoId, { itemId, nombre, cantidad, precioUnitario });
    res.status(201).json(getPedido(pedidoId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al agregar el item al pedido." });
  }
});

app.get("/pedidos/:id", (req, res) => {
  const pedido = getPedido(Number(req.params.id));
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado." });
  res.json(pedido);
});

app.put("/pedidos/:id/estado", (req, res) => {
  try {
    const { estado } = req.body;
    const pedido = actualizarEstado(Number(req.params.id), estado);
    res.json(pedido);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/pedidos", (req, res) => {
  res.json({ pedidos: listarPedidos({ estado: req.query.estado }) });
});

// ---------------------------------------------------------------------------
// Arranque: inicializa esquema de BD y embeddings del RAG antes de escuchar.
// ---------------------------------------------------------------------------
async function start() {
  console.log("[Servidor] Inicializando base de datos...");
  initSchema();

  console.log("[Servidor] Inicializando motor RAG (esto puede tardar la primera vez)...");
  await initRag();

  app.listen(PORT, () => {
    console.log(`[Servidor] Marbella Club backend escuchando en http://localhost:${PORT}`);
  });
}

start();
