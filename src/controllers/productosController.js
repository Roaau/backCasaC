import Producto from "../models/Producto.js";

// OBTENER TODOS
export const getAll = async (req, res) => {
  try {
    // Ordenamos por ID para que no salten al editar
    const productos = await Producto.findAll({
      order: [['producto_id', 'DESC']] 
    });
    res.json(productos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener productos" });
  }
};

// CREAR PRODUCTO (NUEVO)
export const createProducto = async (req, res) => {
  try {
    // req.body ya trae: nombre, codigo_barras, categoria, precio_menudeo...
    const nuevoProducto = await Producto.create(req.body);
    
    res.json({ 
        msg: "Producto creado correctamente", 
        producto: nuevoProducto 
    });
  } catch (err) {
    console.error(err);
    // Si es error de duplicado (código barras repetido)
    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ error: "El código de barras ya existe." });
    }
    res.status(500).json({ error: "Error al crear producto" });
  }
};

// ACTUALIZAR PRODUCTO (NUEVO)
export const updateProducto = async (req, res) => {
  try {
    const { id } = req.params;
    
    // update retorna un array donde el primer elemento es el número de filas afectadas
    const [updated] = await Producto.update(req.body, {
      where: { producto_id: id }
    });

    if (updated) {
      const productoActualizado = await Producto.findByPk(id);
      return res.json({ 
          msg: "Producto actualizado", 
          producto: productoActualizado 
      });
    }

    throw new Error('Producto no encontrado');
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
};

// ELIMINAR PRODUCTO
export const deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Opción A: Borrado Físico (Desaparece de la BD)
    const filasEliminadas = await Producto.destroy({ where: { producto_id: id } });

    // Opción B: Si quisieras borrado lógico (Solo cambiar activo a false)
    // const [updated] = await Producto.update({ activo: false }, { where: { producto_id: id } });

    if (filasEliminadas === 0) {
        return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ msg: "Producto eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
};