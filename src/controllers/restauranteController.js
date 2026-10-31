import { Op, QueryTypes } from "sequelize";
import sequelize from "../config/database.js";
import Producto from "../models/Producto.js";
import Venta from "../models/Venta.js";
import { Mesa, Comanda, ComandaItem } from "../models/Restaurante.js";
import { esAdminEmpresa, resolverSucursalOperativa, responderErrorScope } from "../utils/scope.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import { precioUnitarioServidor } from "../utils/ventas.js";
import { cantidadValida } from "../utils/giros.js";

// Restaurantes: mesas, comandas (cuentas abiertas), envio a cocina y cobro.
// El cobro reutiliza la venta normal (POST /api/ventas) y luego cierra la comanda con su venta_id.

const error = (mensaje, status = 400) => Object.assign(new Error(mensaje), { status });
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const comandaDeLaSucursal = async (req, comanda_id, { abierta = true, transaction } = {}) => {
  const sucursal_id = await resolverSucursalOperativa(req);
  const comanda = await Comanda.findOne({
    where: { comanda_id, empresa_id: req.usuario.empresa_id, sucursal_id },
    transaction, lock: transaction ? true : undefined
  });
  if (!comanda) throw error("Comanda no encontrada", 404);
  if (abierta && comanda.estado !== "ABIERTA") throw error("Esta comanda ya se cerró", 409);
  return comanda;
};

const detalleComanda = async (comanda) => {
  const items = await ComandaItem.findAll({ where: { comanda_id: comanda.comanda_id }, order: [["item_id", "ASC"]] });
  const vigentes = items.filter(i => i.estado !== "CANCELADO");
  const mesa = comanda.mesa_id ? await Mesa.findByPk(comanda.mesa_id, { attributes: ["mesa_id", "nombre"] }) : null;
  return {
    ...comanda.toJSON(),
    mesa: mesa ? mesa.nombre : null,
    items: items.map(i => ({ ...i.toJSON(), cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario), subtotal: r2(Number(i.precio_unitario) * Number(i.cantidad)) })),
    total: r2(vigentes.reduce((s, i) => s + Number(i.precio_unitario) * Number(i.cantidad), 0)),
    por_enviar: items.filter(i => i.estado === "CAPTURADO").length
  };
};

// ── Mesas ────────────────────────────────────────────────────────────────────

// GET /api/restaurante/mesas — mesas de la sucursal con su comanda abierta (si hay) y las de "para llevar"
export const listarMesas = async (req, res) => {
  try {
    const sucursal_id = await resolverSucursalOperativa(req);
    const [mesas, abiertas] = await Promise.all([
      Mesa.findAll({ where: { empresa_id: req.usuario.empresa_id, sucursal_id, activa: true }, order: [["orden", "ASC"], ["mesa_id", "ASC"]] }),
      sequelize.query(`
        SELECT c.comanda_id, c.mesa_id, c.nombre_cliente, c.personas, c.abierta_en, u.nombre AS mesero,
               COALESCE(SUM(CASE WHEN i.estado <> 'CANCELADO' THEN i.precio_unitario * i.cantidad ELSE 0 END), 0)::float AS total,
               COUNT(*) FILTER (WHERE i.estado = 'CAPTURADO')::int AS por_enviar,
               COUNT(*) FILTER (WHERE i.estado = 'LISTO')::int AS listos
          FROM comandas c
          LEFT JOIN comanda_items i ON i.comanda_id = c.comanda_id
          LEFT JOIN usuarios u ON u.usuario_id = c.usuario_id
         WHERE c.empresa_id = :empresa_id AND c.sucursal_id = :sucursal_id AND c.estado = 'ABIERTA'
         GROUP BY c.comanda_id, u.nombre
         ORDER BY c.abierta_en`, { replacements: { empresa_id: req.usuario.empresa_id, sucursal_id }, type: QueryTypes.SELECT })
    ]);
    const porMesa = new Map(abiertas.filter(c => c.mesa_id).map(c => [c.mesa_id, c]));
    res.json({
      mesas: mesas.map(m => ({ ...m.toJSON(), comanda: porMesa.get(m.mesa_id) || null })),
      para_llevar: abiertas.filter(c => !c.mesa_id)
    });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// POST /api/restaurante/mesas { nombre } (admin)  — también acepta { cantidad } para crear "Mesa 1..N"
export const crearMesas = async (req, res) => {
  try {
    if (!esAdminEmpresa(req.usuario)) throw error("Solo el administrador configura las mesas", 403);
    const sucursal_id = await resolverSucursalOperativa(req);
    const existentes = await Mesa.count({ where: { empresa_id: req.usuario.empresa_id, sucursal_id, activa: true } });
    const nombres = [];
    const cantidad = Math.min(60, Math.max(0, Number(req.body?.cantidad) || 0));
    if (cantidad) for (let i = 1; i <= cantidad; i++) nombres.push(`Mesa ${existentes + i}`);
    else {
      const nombre = String(req.body?.nombre || "").trim().slice(0, 40);
      if (!nombre) throw error("Escribe el nombre de la mesa");
      nombres.push(nombre);
    }
    const creadas = [];
    for (const [i, nombre] of nombres.entries()) {
      creadas.push(await Mesa.create({ empresa_id: req.usuario.empresa_id, sucursal_id, nombre, orden: existentes + i + 1 }));
    }
    res.status(201).json(creadas);
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// PUT /api/restaurante/mesas/:id { nombre?, activa? } (admin)
export const actualizarMesa = async (req, res) => {
  try {
    if (!esAdminEmpresa(req.usuario)) throw error("Solo el administrador configura las mesas", 403);
    const sucursal_id = await resolverSucursalOperativa(req);
    const mesa = await Mesa.findOne({ where: { mesa_id: req.params.id, empresa_id: req.usuario.empresa_id, sucursal_id } });
    if (!mesa) throw error("Mesa no encontrada", 404);
    const cambios = {};
    if (req.body?.nombre !== undefined) cambios.nombre = String(req.body.nombre).trim().slice(0, 40) || mesa.nombre;
    if (req.body?.activa !== undefined) {
      if (req.body.activa === false) {
        const ocupada = await Comanda.count({ where: { mesa_id: mesa.mesa_id, estado: "ABIERTA" } });
        if (ocupada) throw error("La mesa tiene una cuenta abierta; cóbrala o muévela antes de quitarla", 409);
      }
      cambios.activa = req.body.activa === true;
    }
    await mesa.update(cambios);
    res.json(mesa);
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// ── Comandas ─────────────────────────────────────────────────────────────────

// POST /api/restaurante/comandas { mesa_id?, nombre_cliente?, personas? }
export const abrirComanda = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const sucursal_id = await resolverSucursalOperativa(req);
    const mesa_id = req.body?.mesa_id ? Number(req.body.mesa_id) : null;
    if (mesa_id) {
      const mesa = await Mesa.findOne({ where: { mesa_id, empresa_id: req.usuario.empresa_id, sucursal_id, activa: true }, transaction: t, lock: true });
      if (!mesa) throw error("Mesa no encontrada", 404);
      const abierta = await Comanda.findOne({ where: { mesa_id, estado: "ABIERTA" }, transaction: t });
      if (abierta) {
        await t.rollback();
        return res.json(await detalleComanda(abierta));
      }
    } else if (!String(req.body?.nombre_cliente || "").trim()) {
      throw error("Para llevar: escribe el nombre del cliente");
    }
    const comanda = await Comanda.create({
      empresa_id: req.usuario.empresa_id, sucursal_id, mesa_id,
      nombre_cliente: String(req.body?.nombre_cliente || "").trim().slice(0, 80) || null,
      personas: Number(req.body?.personas) > 0 ? Math.min(99, Number(req.body.personas)) : null,
      usuario_id: req.usuario.id
    }, { transaction: t });
    await t.commit();
    res.status(201).json(await detalleComanda(comanda));
  } catch (e) {
    await t.rollback();
    responderErrorScope(res, e);
  }
};

// GET /api/restaurante/comandas/:id
export const verComanda = async (req, res) => {
  try {
    const comanda = await comandaDeLaSucursal(req, req.params.id, { abierta: false });
    res.json(await detalleComanda(comanda));
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// POST /api/restaurante/comandas/:id/items { producto_id, cantidad, notas? }
export const agregarItem = async (req, res) => {
  try {
    const comanda = await comandaDeLaSucursal(req, req.params.id);
    const producto = await Producto.findOne({ where: { producto_id: req.body?.producto_id, empresa_id: req.usuario.empresa_id } });
    if (!producto) throw error("Producto no encontrado", 404);
    const cantidad = Number(req.body?.cantidad || 1);
    if (!cantidadValida(cantidad, producto.unidad_venta)) throw error(`Cantidad inválida para ${producto.nombre}`);
    await ComandaItem.create({
      comanda_id: comanda.comanda_id,
      producto_id: producto.producto_id,
      nombre: producto.nombre,
      cantidad,
      precio_unitario: precioUnitarioServidor(producto, cantidad),
      notas: String(req.body?.notas || "").trim().slice(0, 200) || null
    });
    res.status(201).json(await detalleComanda(comanda));
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// PUT /api/restaurante/comandas/:id/items/:itemId { cantidad?, notas? } — solo si aun no va a cocina
export const editarItem = async (req, res) => {
  try {
    const comanda = await comandaDeLaSucursal(req, req.params.id);
    const item = await ComandaItem.findOne({ where: { item_id: req.params.itemId, comanda_id: comanda.comanda_id } });
    if (!item) throw error("Platillo no encontrado", 404);
    if (item.estado !== "CAPTURADO") throw error("Ese platillo ya se mandó a cocina; para cambiarlo cancélalo y agrega otro", 409);
    const cambios = {};
    if (req.body?.cantidad !== undefined) {
      const cantidad = Number(req.body.cantidad);
      if (!(cantidad > 0)) throw error("La cantidad debe ser mayor a 0");
      cambios.cantidad = cantidad;
    }
    if (req.body?.notas !== undefined) cambios.notas = String(req.body.notas || "").trim().slice(0, 200) || null;
    await item.update(cambios);
    res.json(await detalleComanda(comanda));
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// DELETE /api/restaurante/comandas/:id/items/:itemId — si ya fue a cocina queda como CANCELADO (con PIN si esta activo)
export const quitarItem = async (req, res) => {
  try {
    const comanda = await comandaDeLaSucursal(req, req.params.id);
    const item = await ComandaItem.findOne({ where: { item_id: req.params.itemId, comanda_id: comanda.comanda_id } });
    if (!item) throw error("Platillo no encontrado", 404);
    if (item.estado === "CAPTURADO") await item.destroy();
    else {
      await item.update({ estado: "CANCELADO" });
      await registrarAuditoria(req, { accion: "COMANDA_PLATILLO_CANCELADO", entidad: "comandas", entidad_id: comanda.comanda_id, sucursal_id: comanda.sucursal_id, detalle: { platillo: item.nombre, cantidad: Number(item.cantidad) } });
    }
    res.json(await detalleComanda(comanda));
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// POST /api/restaurante/comandas/:id/enviar — manda a cocina lo capturado
export const enviarACocina = async (req, res) => {
  try {
    const comanda = await comandaDeLaSucursal(req, req.params.id);
    const [enviados] = await ComandaItem.update(
      { estado: "EN_COCINA", enviado_cocina_en: new Date() },
      { where: { comanda_id: comanda.comanda_id, estado: "CAPTURADO" } }
    );
    if (!enviados) throw error("No hay platillos nuevos para mandar a cocina");
    req.app?.get?.("io")?.to(`cocina-${comanda.sucursal_id}`).emit("cocina-actualizada");
    res.json({ ...(await detalleComanda(comanda)), enviados });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// PUT /api/restaurante/comandas/:id/mover { mesa_id } — cambiar de mesa
export const moverComanda = async (req, res) => {
  try {
    const comanda = await comandaDeLaSucursal(req, req.params.id);
    const mesa_id = Number(req.body?.mesa_id);
    const mesa = await Mesa.findOne({ where: { mesa_id, empresa_id: req.usuario.empresa_id, sucursal_id: comanda.sucursal_id, activa: true } });
    if (!mesa) throw error("Mesa no encontrada", 404);
    if (await Comanda.count({ where: { mesa_id, estado: "ABIERTA", comanda_id: { [Op.ne]: comanda.comanda_id } } })) {
      throw error(`${mesa.nombre} ya tiene una cuenta abierta`, 409);
    }
    await comanda.update({ mesa_id });
    res.json(await detalleComanda(comanda));
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// POST /api/restaurante/comandas/:id/cerrar { venta_id } — despues de cobrarla en Vender
export const cerrarComanda = async (req, res) => {
  try {
    const comanda = await comandaDeLaSucursal(req, req.params.id);
    const venta = await Venta.findOne({ where: { venta_id: req.body?.venta_id, sucursal_id: comanda.sucursal_id } });
    if (!venta) throw error("No se encontró la venta de esta cuenta", 404);
    await comanda.update({ estado: "CERRADA", venta_id: venta.venta_id, cerrada_en: new Date() });
    await ComandaItem.update({ estado: "ENTREGADO" }, { where: { comanda_id: comanda.comanda_id, estado: { [Op.in]: ["EN_COCINA", "LISTO"] } } });
    res.json({ mensaje: "Cuenta cobrada", comanda_id: comanda.comanda_id, venta_id: venta.venta_id });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// POST /api/restaurante/comandas/:id/cancelar { motivo } — sin cobrar (PIN si esta activo)
export const cancelarComanda = async (req, res) => {
  try {
    const comanda = await comandaDeLaSucursal(req, req.params.id);
    await comanda.update({ estado: "CANCELADA", cerrada_en: new Date(), notas: String(req.body?.motivo || "").trim().slice(0, 200) || comanda.notas });
    await ComandaItem.update({ estado: "CANCELADO" }, { where: { comanda_id: comanda.comanda_id, estado: { [Op.ne]: "ENTREGADO" } } });
    await registrarAuditoria(req, { accion: "COMANDA_CANCELADA", entidad: "comandas", entidad_id: comanda.comanda_id, sucursal_id: comanda.sucursal_id, detalle: { motivo: req.body?.motivo || null } });
    res.json({ mensaje: "Cuenta cancelada" });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// ── Cocina ───────────────────────────────────────────────────────────────────

// GET /api/restaurante/cocina — platillos en cocina y listos (de cuentas abiertas)
export const pantallaCocina = async (req, res) => {
  try {
    const sucursal_id = await resolverSucursalOperativa(req);
    const items = await sequelize.query(`
      SELECT i.item_id, i.comanda_id, i.nombre, i.cantidad::float AS cantidad, i.notas, i.estado,
             i.enviado_cocina_en, i.listo_en, m.nombre AS mesa, c.nombre_cliente
        FROM comanda_items i
        JOIN comandas c ON c.comanda_id = i.comanda_id
        LEFT JOIN mesas m ON m.mesa_id = c.mesa_id
       WHERE c.empresa_id = :empresa_id AND c.sucursal_id = :sucursal_id AND c.estado = 'ABIERTA'
         AND i.estado IN ('EN_COCINA', 'LISTO')
       ORDER BY i.enviado_cocina_en ASC, i.item_id ASC`,
      { replacements: { empresa_id: req.usuario.empresa_id, sucursal_id }, type: QueryTypes.SELECT });
    res.json(items);
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// PUT /api/restaurante/cocina/:itemId { estado: 'LISTO' | 'ENTREGADO' | 'EN_COCINA' }
export const cambiarEstadoItem = async (req, res) => {
  try {
    const estado = String(req.body?.estado || "").toUpperCase();
    if (!["EN_COCINA", "LISTO", "ENTREGADO"].includes(estado)) throw error("Estado no válido");
    const sucursal_id = await resolverSucursalOperativa(req);
    const [item] = await sequelize.query(`
      SELECT i.item_id FROM comanda_items i JOIN comandas c ON c.comanda_id = i.comanda_id
       WHERE i.item_id = :item_id AND c.empresa_id = :empresa_id AND c.sucursal_id = :sucursal_id AND c.estado = 'ABIERTA'`,
      { replacements: { item_id: Number(req.params.itemId), empresa_id: req.usuario.empresa_id, sucursal_id }, type: QueryTypes.SELECT });
    if (!item) throw error("Platillo no encontrado", 404);
    await ComandaItem.update({ estado, listo_en: estado === "LISTO" ? new Date() : null }, { where: { item_id: item.item_id } });
    req.app?.get?.("io")?.to(`cocina-${sucursal_id}`).emit("cocina-actualizada");
    res.json({ item_id: item.item_id, estado });
  } catch (e) {
    responderErrorScope(res, e);
  }
};
