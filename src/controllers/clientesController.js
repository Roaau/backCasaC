import { Op, fn, col, where as sqlWhere } from "sequelize";
import Cliente from "../models/Cliente.js";
import { obtenerEmpresaId, parseIdPositivo, responderErrorScope } from "../utils/scope.js";

const texto = (valor, max) => {
  const t = String(valor ?? "").trim().slice(0, max);
  return t || null;
};

// Solo digitos: "228 123 4567" y "2281234567" son el mismo cliente
const soloDigitos = (valor) => String(valor ?? "").replace(/\D/g, "").slice(0, 20) || null;

const limpiar = (body) => ({
  nombre:     texto(body.nombre, 200),
  telefono:   soloDigitos(body.telefono),
  direccion:  texto(body.direccion, 500),
  referencia: texto(body.referencia, 500)
});

// GET /api/clientes?q=   (con q: maximo 10, para el buscador de la venta)
export const listarClientes = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const q = req.query.q?.toString().trim() || "";
    const where = { empresa_id, activo: true };
    if (q) {
      const digitos = q.replace(/\D/g, "");
      where[Op.or] = [
        { nombre:    { [Op.iLike]: `%${q}%` } },
        { direccion: { [Op.iLike]: `%${q}%` } },
        ...(digitos.length >= 3 ? [{ telefono: { [Op.like]: `%${digitos}%` } }] : [])
      ];
    }
    const clientes = await Cliente.findAll({
      where,
      order: [["nombre", "ASC"]],
      limit: q ? 10 : 1000
    });
    res.json(clientes);
  } catch (err) {
    responderErrorScope(res, err);
  }
};

// POST /api/clientes
// Si ya existe (mismo telefono, o mismo nombre sin telefono) se actualiza en vez de duplicarlo.
export const guardarCliente = async (req, res) => {
  const datos = limpiar(req.body);
  if (!datos.nombre) return res.status(400).json({ error: "El nombre del cliente es requerido" });
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const existente = await Cliente.findOne({
      where: datos.telefono
        ? { empresa_id, activo: true, telefono: datos.telefono }
        : { empresa_id, activo: true, telefono: null, [Op.and]: [sqlWhere(fn("lower", col("nombre")), datos.nombre.toLowerCase())] }
    });
    if (existente) {
      // Solo se reemplaza lo que trae dato: un pedido sin referencia no borra la guardada
      const cambios = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== null));
      await existente.update(cambios);
      return res.json(existente);
    }
    const cliente = await Cliente.create({ empresa_id, ...datos });
    res.status(201).json(cliente);
  } catch (err) {
    responderErrorScope(res, err);
  }
};

// PUT /api/clientes/:id  (edicion completa: un campo vacio si se borra)
export const actualizarCliente = async (req, res) => {
  const id = parseIdPositivo(req.params.id);
  if (!id) return res.status(400).json({ error: "Cliente invalido" });
  const datos = limpiar(req.body);
  if (!datos.nombre) return res.status(400).json({ error: "El nombre del cliente es requerido" });
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const cliente = await Cliente.findOne({ where: { cliente_id: id, empresa_id, activo: true } });
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
    await cliente.update(datos);
    res.json(cliente);
  } catch (err) {
    responderErrorScope(res, err);
  }
};

// DELETE /api/clientes/:id
export const eliminarCliente = async (req, res) => {
  const id = parseIdPositivo(req.params.id);
  if (!id) return res.status(400).json({ error: "Cliente invalido" });
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const cliente = await Cliente.findOne({ where: { cliente_id: id, empresa_id, activo: true } });
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
    await cliente.update({ activo: false });
    res.json({ mensaje: "Cliente eliminado" });
  } catch (err) {
    responderErrorScope(res, err);
  }
};
