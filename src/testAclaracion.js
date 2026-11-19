// Node.js 22.x
const { initRag, buscarConAclaracion } = require("./ragEngine");

const MARGENES = [0.02, 0.03, 0.05, 0.08, 0.1];

const desarrollo = [
  ["quiero un ceviche mixto grande", ["cev003"]],
  ["el ceviche mas barato que tengan", ["cev010"]],
  ["algo con pulpo", ["cev006"]],
  ["un cevichop para llevar, el clasico", ["chp001"]],
  ["solo quiero la leche de tigre", ["chp007"]],
  ["un arroz chaufa con mariscos", ["arr003"]],
  ["tienen lomo saltado?", ["cri001"]],
  ["quiero algo picante en crema de rocoto", ["cev007"]],
  ["una parihuela para el frio", ["sud003"]],
  ["el combo para compartir en familia, algo grande", ["ron001"]],
  ["un tiradito clasico de entrada", ["tir001"]],
  ["ají de gallina porfa", ["cri007"]],
];

const evaluacion = [
  ["un ceviche clasico porfa", ["cev002"]],
  ["ceviche norteño", ["cev001"]],
  ["quiero el ceviche de pulpo", ["cev006"]],
  ["ceviche al olivo", ["cev009"]],
  ["dame un tiradito en crema de rocoto", ["tir002"]],
  ["tiradito al olivo", ["tir004"]],
  ["una leche de tigre bien fuerte", ["chp007"]],
  ["un chilcano", ["chp008"]],
  ["lomo saltado para dos", ["cri001"]],
  ["pollo a la plancha", ["cri003"]],
  ["tallarines rojos", ["cri008"]],
  ["papa a la huancaina", ["cri009"]],
  ["caldo de gallina bien caliente", ["cri012"]],
  ["arroz con langostinos", ["arr002"]],
  ["arroz chaufa de pescado", ["arr004"]],
  ["milanesa de pollo", ["cri006"]],
  ["nuggets para el niño", ["cri004"]],
  ["cabrito a la norteña", ["cri013"]],
  ["un asopado de camarones", ["cri014"]],
  ["sudado de pescado", ["sud001"]],
  ["crocante de calamar", ["cro002"]],
  ["ronda marina 2", ["ron002"]],
  ["cevichop con crema de ají amarillo", ["chp004"]],
  ["un mini cevichop", ["chp006"]],
  ["ceviche de pescado con chaufa de mariscos y crocante de pescado", ["trio004"]],
  ["ceviche carretillero", ["cev010"]],
  ["el ceviche en crema de aji amarillo", ["cev008"]],
  ["carapulcra", ["cri011"]],
  ["quiero un cebiche clasico", ["cev002"]],
  ["lomo saltao", ["cri001"]],
  ["una aji de gayina", ["cri007"]],
  ["cevichop mixto", ["chp002"]],
  ["un ceviche mixto", ["cev003"]],
  ["un mixto", ["cev003", "chp002", "cro003", "sud002", "arr005"], true],
  ["un crocante", ["cro001", "cro002", "cro003", "cri005"], true],
  ["arroz chaufa", ["arr003", "arr004", "arr005"], true],
  ["un tiradito", ["tir001", "tir002", "tir003", "tir004"], true],
  ["un sudado", ["sud001", "sud002"], true],
  ["ceviche con crocante", ["duo003", "duo004", "duo005"], true],
  ["un cevichop", ["chp001", "chp002", "chp003", "chp004", "chp005"], true],
];

async function evaluar(casos, margen) {
  let directo = 0, util = 0, fallida = 0, silencioso = 0, ambBien = 0, ambMal = 0, preguntas = 0, base = 0;
  for (const [consulta, esperados, ambiguaReal] of casos) {
    const r = await buscarConAclaracion(consulta, 3, margen);
    const top1 = r.resultados[0].item.id;
    if (!ambiguaReal && esperados.includes(top1)) base++;
    if (r.ambiguo) preguntas++;
    const ids = r.candidatos.map((c) => c.item.id);
    if (ambiguaReal) {
      if (r.ambiguo && ids.some((id) => esperados.includes(id))) ambBien++;
      else ambMal++;
    } else if (!r.ambiguo) {
      if (esperados.includes(top1)) directo++;
      else silencioso++;
    } else if (ids.some((id) => esperados.includes(id))) util++;
    else fallida++;
  }
  const n = casos.length;
  const manejo = directo + util + ambBien;
  return { n, margen, base, directo, util, fallida, silencioso: silencioso + ambMal, ambBien, ambMal, preguntas, manejo };
}

async function main() {
  await initRag();
  for (const [nombre, casos] of [["DESARROLLO", desarrollo], ["EVALUACION", evaluacion]]) {
    console.log(`\n== ${nombre} (${casos.length} consultas) ==`);
    console.log("margen | solo_top1 | directo | aclaracion_util | aclaracion_fallida | error_silencioso | preguntas | manejo_correcto");
    for (const m of [0, ...MARGENES]) {
      const r = await evaluar(casos, m);
      const pct = (x) => `${x} (${((x / r.n) * 100).toFixed(1)}%)`;
      console.log(`${m.toFixed(2)}   | ${pct(r.base)} | ${r.directo} | ${r.util} | ${r.fallida} | ${pct(r.silencioso)} | ${pct(r.preguntas)} | ${pct(r.manejo)}`);
    }
  }
  console.log("\n== Detalle de gaps en EVALUACION ==");
  for (const [consulta, esperados, amb] of evaluacion) {
    const r = await buscarConAclaracion(consulta, 3, 0.05);
    console.log(`${amb ? "AMB" : "   "} | ${consulta} | ${r.resultados.slice(0, 3).map((x) => x.item.id + ":" + x.score.toFixed(3)).join(" ")} | gap ${r.diferencia.toFixed(3)} | ${esperados.slice(0, 2).join(",")}`);
  }
}
main();
