// Node.js 22.x
// Modulo RAG: embeddings semanticos del menu real de Marbella Club Cevicheria.
// Usa @xenova/transformers (modelo all-MiniLM-L6-v2) para generar embeddings
// locales, sin depender de una API externa de embeddings.

const fs = require("fs");
const path = require("path");

const MENU_PATH = path.join(__dirname, "data", "menu.json");
const EMBEDDINGS_CACHE_PATH = path.join(__dirname, "data", "menu.embeddings.json");

let extractorPromise = null;
let menuItems = [];
let menuEmbeddings = [];

function textoParaEmbedding(item) {
  const partes = [
    item.nombre,
    item.categoria,
    item.descripcion || "",
    (item.sinonimos || []).join(", "),
  ];
  return partes.filter(Boolean).join(". ");
}

async function getExtractor() {
  if (!extractorPromise) {
    const { pipeline } = await import("@xenova/transformers");
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractorPromise;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embed(texto) {
  const extractor = await getExtractor();
  const output = await extractor(texto, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

// Construye (o carga desde cache) los embeddings de todos los items del menu.
// Se recalculan automaticamente si menu.json cambio despues del ultimo cache.
async function initRag() {
  menuItems = JSON.parse(fs.readFileSync(MENU_PATH, "utf-8"));

  const menuMtime = fs.statSync(MENU_PATH).mtimeMs;
  if (fs.existsSync(EMBEDDINGS_CACHE_PATH)) {
    const cache = JSON.parse(fs.readFileSync(EMBEDDINGS_CACHE_PATH, "utf-8"));
    if (cache.menuMtime === menuMtime && cache.embeddings.length === menuItems.length) {
      menuEmbeddings = cache.embeddings;
      console.log(`[RAG] Embeddings cargados desde cache (${menuEmbeddings.length} items).`);
      return;
    }
  }

  console.log(`[RAG] Generando embeddings para ${menuItems.length} items del menu...`);
  menuEmbeddings = [];
  for (const item of menuItems) {
    const vector = await embed(textoParaEmbedding(item));
    menuEmbeddings.push(vector);
  }

  fs.writeFileSync(
    EMBEDDINGS_CACHE_PATH,
    JSON.stringify({ menuMtime, embeddings: menuEmbeddings })
  );
  console.log("[RAG] Embeddings generados y cacheados.");
}

// Busqueda semantica: devuelve los topK items del menu mas relevantes a la consulta.
async function buscarEnMenu(consulta, topK = 3) {
  if (menuItems.length === 0) {
    throw new Error("RAG no inicializado. Llama a initRag() antes de buscar.");
  }
  const consultaVector = await embed(consulta);

  const resultados = menuItems.map((item, i) => ({
    item,
    score: cosineSimilarity(consultaVector, menuEmbeddings[i]),
  }));

  resultados.sort((a, b) => b.score - a.score);
  return resultados.slice(0, topK);
}

function getMenuCompleto() {
  return menuItems;
}

module.exports = { initRag, buscarEnMenu, getMenuCompleto };
