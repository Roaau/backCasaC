/**
 * Seeding de catálogos SAT — correr UNA sola vez:
 *   node scripts/seed-sat.js
 */

import "dotenv/config";
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";
import sequelize from "../src/config/database.js";

import CatSatFormaPago        from "../src/models/CatSatFormaPago.js";
import CatSatMetodoPago       from "../src/models/CatSatMetodoPago.js";
import CatSatUsoCfdi          from "../src/models/CatSatUsoCfdi.js";
import CatSatRegimenFiscal    from "../src/models/CatSatRegimenFiscal.js";
import CatSatUnidad           from "../src/models/CatSatUnidad.js";
import CatSatProductoServicio from "../src/models/CatSatProductoServicio.js";
import CatSatCp               from "../src/models/CatSatCp.js";
import CatSatColonia          from "../src/models/CatSatColonia.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_DIR = path.join(__dirname, "excel");
const V4        = path.join(EXCEL_DIR, "catCFDI_v4.xlsx");
const PRODS     = path.join(EXCEL_DIR, "catCFDI_productos.xlsx");
const CPS       = path.join(EXCEL_DIR, "catCFDI_V_4_cp.xlsx");
const COLONIAS  = path.join(EXCEL_DIR, "catCFDI_V_4_colonias.xlsx");

// aplica_fisica / aplica_moral por clave (los que difieren de true/true)
const USO_CFDI_APLICA = {
  D01: [true,  false], D02: [true, false], D03: [true, false],
  D04: [true,  false], D05: [true, false], D06: [true, false],
  D07: [true,  false], D08: [true, false], D09: [true, false],
  D10: [true,  false], CN01:[true, false],
};

const REGIMEN_MORAL = new Set(["601","603","620","623","624"]);
const REGIMEN_FISICA= new Set(["605","606","607","608","611","612","614","615","616","621","625"]);
const REGIMEN_AMBOS = new Set(["610","622","626"]);

async function bulkUpsert(Model, data, updateCols) {
  if (!data.length) return;
  const CHUNK = 500;
  for (let i = 0; i < data.length; i += CHUNK) {
    await Model.bulkCreate(data.slice(i, i + CHUNK), { updateOnDuplicate: updateCols });
  }
}

function str(v) {
  if (v === null || v === undefined) return null;
  return v.toString().trim();
}

async function loadSheet(file, sheetName) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  return sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0];
}

// ── Forma de Pago ──────────────────────────────────────────────────────────────
// Clave es número en Excel (1 → "01"). Datos desde fila 2.
async function seedFormaPago() {
  const ws = await loadSheet(V4, "c_FormaPago");
  const data = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const clave = str(row.getCell(1).value);
    const desc  = str(row.getCell(2).value);
    if (!clave || !desc || desc === "Descripcion") return;
    data.push({ clave: clave.padStart(2, "0"), descripcion: desc });
  });
  await bulkUpsert(CatSatFormaPago, data, ["descripcion"]);
  console.log(`  ✓ Formas de pago: ${data.length}`);
}

// ── Método de Pago ─────────────────────────────────────────────────────────────
// Datos desde fila 2.
async function seedMetodoPago() {
  const ws = await loadSheet(V4, "c_MetodoPago");
  const data = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const clave = str(row.getCell(1).value);
    const desc  = str(row.getCell(2).value);
    if (!clave || !desc || clave === "c_MetodoPago") return;
    data.push({ clave, descripcion: desc });
  });
  await bulkUpsert(CatSatMetodoPago, data, ["descripcion"]);
  console.log(`  ✓ Métodos de pago: ${data.length}`);
}

// ── Uso CFDI ──────────────────────────────────────────────────────────────────
// Fila 2 es header duplicado → datos desde fila 3.
async function seedUsoCfdi() {
  const ws = await loadSheet(V4, "c_UsoCFDI");
  const data = [];
  ws.eachRow((row, n) => {
    if (n <= 2) return;
    const clave = str(row.getCell(1).value);
    const desc  = str(row.getCell(2).value);
    if (!clave || !desc || clave === "c_UsoCFDI") return;
    const [af, am] = USO_CFDI_APLICA[clave] ?? [true, true];
    data.push({ clave, descripcion: desc, aplica_fisica: af, aplica_moral: am });
  });
  await bulkUpsert(CatSatUsoCfdi, data, ["descripcion", "aplica_fisica", "aplica_moral"]);
  console.log(`  ✓ Usos CFDI: ${data.length}`);
}

// ── Régimen Fiscal ─────────────────────────────────────────────────────────────
// Clave es número en Excel (601 → "601"). Datos desde fila 2.
async function seedRegimenFiscal() {
  const ws = await loadSheet(V4, "c_RegimenFiscal");
  const data = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const claveRaw = str(row.getCell(1).value);
    const desc     = str(row.getCell(2).value);
    if (!claveRaw || !desc || claveRaw === "c_RegimenFiscal") return;
    const clave = claveRaw.padStart(3, "0");
    const af = !REGIMEN_MORAL.has(clave);
    const am = !REGIMEN_FISICA.has(clave);
    data.push({ clave, descripcion: desc, aplica_fisica: af, aplica_moral: am });
  });
  await bulkUpsert(CatSatRegimenFiscal, data, ["descripcion", "aplica_fisica", "aplica_moral"]);
  console.log(`  ✓ Regímenes fiscales: ${data.length}`);
}

// ── Unidades ──────────────────────────────────────────────────────────────────
// Clave puede ser número (Excel auto-convirtió) o string. Datos desde fila 2.
async function seedUnidades() {
  const ws = await loadSheet(V4, "c_ClaveUnidad");
  const data = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const clave  = str(row.getCell(1).value);
    const nombre = str(row.getCell(2).value);
    if (!clave || !nombre || clave === "c_ClaveUnidad") return;
    data.push({ clave, nombre, descripcion: null });
  });
  await bulkUpsert(CatSatUnidad, data, ["nombre"]);
  console.log(`  ✓ Unidades: ${data.length}`);
}

// ── Productos/Servicios ────────────────────────────────────────────────────────
// Clave puede ser número (10101500) o string ("01010101"). Pad a 8 chars.
async function seedProductosServicios() {
  const ws = await loadSheet(PRODS, null);
  const data = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const claveRaw = str(row.getCell(1).value);
    const desc     = str(row.getCell(2).value);
    if (!claveRaw || !desc || claveRaw === "c_claveprodserv") return;
    data.push({ clave: claveRaw.padStart(8, "0"), descripcion: desc });
  });
  await bulkUpsert(CatSatProductoServicio, data, ["descripcion"]);
  console.log(`  ✓ Productos/Servicios: ${data.length}`);
}

// ── CPs ───────────────────────────────────────────────────────────────────────
// Fila 2 es header duplicado → datos desde fila 3. Solo tiene cp y estado (clave).
async function seedCps() {
  const ws = await loadSheet(CPS, null);
  const data = [];
  ws.eachRow((row, n) => {
    if (n <= 2) return;
    const cp     = str(row.getCell(1).value);
    const estado = str(row.getCell(2).value);
    if (!cp || cp === "c_codigopostal") return;
    data.push({ cp: cp.padStart(5, "0"), estado: estado || null, municipio: null });
  });
  await bulkUpsert(CatSatCp, data, ["estado"]);
  console.log(`  ✓ CPs: ${data.length}`);
}

// ── Colonias ──────────────────────────────────────────────────────────────────
// col1=código colonia (ignorar), col2=cp, col3=nombre. Datos desde fila 2.
// Solo insertar si la tabla está vacía (PK serial, no hay upsert natural).
async function seedColonias() {
  const count = await CatSatColonia.count();
  if (count > 0) {
    console.log(`  - Colonias: ya tiene ${count} registros — omitido`);
    return;
  }
  const ws = await loadSheet(COLONIAS, null);
  const data = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const cp      = str(row.getCell(2).value);
    const colonia = str(row.getCell(3).value);
    if (!cp || !colonia || cp === "c_codigopostal") return;
    data.push({ cp: cp.padStart(5, "0"), colonia, tipo_asentamiento: null });
  });
  // Insertar en chunks sin updateOnDuplicate (PK serial)
  const CHUNK = 500;
  for (let i = 0; i < data.length; i += CHUNK) {
    await CatSatColonia.bulkCreate(data.slice(i, i + CHUNK), { ignoreDuplicates: true });
  }
  console.log(`  ✓ Colonias: ${data.length}`);
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  console.log("Seeding catálogos SAT...\n");

  await seedFormaPago();
  await seedMetodoPago();
  await seedUsoCfdi();
  await seedRegimenFiscal();
  await seedUnidades();
  await seedProductosServicios();
  await seedCps();
  await seedColonias();

  console.log("\nSeeding completado.");
  await sequelize.close();
}

main().catch((err) => {
  console.error("Error en seeding:", err);
  process.exit(1);
});
