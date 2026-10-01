// Node.js 22.x
// Script para crear/asegurar el esquema de la base de datos SQLite.
// Uso: npm run init:db

const { initSchema } = require("./db");

initSchema();
console.log("[DB] Esquema de pedidos.db creado/verificado correctamente.");
