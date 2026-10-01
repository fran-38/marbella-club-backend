// Node.js 22.x
// Script de prueba: corre un set de consultas en lenguaje natural contra el
// menu real de Marbella Club y mide precision (si el item esperado aparece
// en el top-1 resultado del RAG). Sirve como evidencia de desempeño para el
// Capitulo IV / V de la tesis (igual que se hizo con el menu de ejemplo,
// que dio 81.8% de precision, 9/11 casos).
//
// Uso: npm run test:rag

const { initRag, buscarEnMenu } = require("./ragEngine");

// Cada caso: una consulta en lenguaje natural real + el id del item que
// deberia aparecer como resultado top-1.
const casosDePrueba = [
  { consulta: "quiero un ceviche mixto grande", esperado: "cev003" },
  { consulta: "el ceviche mas barato que tengan", esperado: "cev010" },
  { consulta: "algo con pulpo", esperado: "cev006" },
  { consulta: "un cevichop para llevar, el clasico", esperado: "chp001" },
  { consulta: "solo quiero la leche de tigre", esperado: "chp007" },
  { consulta: "un arroz chaufa con mariscos", esperado: "arr003" },
  { consulta: "tienen lomo saltado?", esperado: "cri001" },
  { consulta: "quiero algo picante en crema de rocoto", esperado: "cev007" },
  { consulta: "una parihuela para el frio", esperado: "sud003" },
  { consulta: "el combo para compartir en familia, algo grande", esperado: "ron001" },
  { consulta: "un tiradito clasico de entrada", esperado: "tir001" },
  { consulta: "ají de gallina porfa", esperado: "cri007" },
];

async function correrPruebas() {
  console.log("Inicializando RAG con el menu real...\n");
  await initRag();

  let aciertos = 0;
  const fallos = [];

  for (const caso of casosDePrueba) {
    const [top1] = await buscarEnMenu(caso.consulta, 1);
    const acierto = top1.item.id === caso.esperado;
    if (acierto) {
      aciertos++;
    } else {
      fallos.push({ ...caso, obtenido: `${top1.item.id} (${top1.item.nombre})` });
    }
    console.log(
      `${acierto ? "OK  " : "FAIL"} | "${caso.consulta}" -> ${top1.item.nombre} [${top1.item.id}] (similitud ${top1.score.toFixed(3)})`
    );
  }

  const precision = ((aciertos / casosDePrueba.length) * 100).toFixed(1);
  console.log(`\nPrecision: ${aciertos}/${casosDePrueba.length} (${precision}%)`);

  if (fallos.length > 0) {
    console.log("\nCasos fallidos (material de discusion para la tesis):");
    fallos.forEach((f) =>
      console.log(`  - "${f.consulta}" -> esperado ${f.esperado}, obtenido ${f.obtenido}`)
    );
  }
}

correrPruebas();
