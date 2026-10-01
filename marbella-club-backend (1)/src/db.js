// Node.js 22.x / 24.x
// Capa de persistencia: SQLite (node:sqlite, nativo de Node desde la v22.5,
// sin dependencias externas ni compilacion nativa) para pedidos reales del
// asistente conversacional. Sustituye a cualquier estado en memoria de Voiceflow.

const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = path.join(__dirname, "data", "pedidos.db");
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_whatsapp TEXT NOT NULL,
      cliente_nombre TEXT,
      estado TEXT NOT NULL DEFAULT 'en_proceso', -- en_proceso | confirmado | cancelado | entregado
      creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS pedido_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,       -- id del item en menu.json (ej. "cev003")
      nombre TEXT NOT NULL,
      cantidad INTEGER NOT NULL DEFAULT 1,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
    );
  `);
}

function crearPedido(clienteWhatsapp, clienteNombre = null) {
  const stmt = db.prepare(
    "INSERT INTO pedidos (cliente_whatsapp, cliente_nombre) VALUES (?, ?)"
  );
  const info = stmt.run(clienteWhatsapp, clienteNombre);
  return info.lastInsertRowid;
}

function agregarItem(pedidoId, { itemId, nombre, cantidad, precioUnitario }) {
  const subtotal = cantidad * precioUnitario;
  const stmt = db.prepare(`
    INSERT INTO pedido_items (pedido_id, item_id, nombre, cantidad, precio_unitario, subtotal)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(pedidoId, itemId, nombre, cantidad, precioUnitario, subtotal);
  return subtotal;
}

function getPedido(pedidoId) {
  const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(pedidoId);
  if (!pedido) return null;
  const items = db
    .prepare("SELECT * FROM pedido_items WHERE pedido_id = ?")
    .all(pedidoId);
  const total = items.reduce((sum, it) => sum + it.subtotal, 0);
  return { ...pedido, items, total };
}

function actualizarEstado(pedidoId, estado) {
  const estadosValidos = ["en_proceso", "confirmado", "cancelado", "entregado"];
  if (!estadosValidos.includes(estado)) {
    throw new Error(`Estado invalido: ${estado}`);
  }
  db.prepare("UPDATE pedidos SET estado = ? WHERE id = ?").run(estado, pedidoId);
  return getPedido(pedidoId);
}

function listarPedidos({ estado } = {}) {
  if (estado) {
    return db.prepare("SELECT * FROM pedidos WHERE estado = ? ORDER BY creado_en DESC").all(estado);
  }
  return db.prepare("SELECT * FROM pedidos ORDER BY creado_en DESC").all();
}

module.exports = {
  db,
  initSchema,
  crearPedido,
  agregarItem,
  getPedido,
  actualizarEstado,
  listarPedidos,
};
