import Producto from "../models/Producto.js";

export const getAll = async (req, res) => {
  try {
    const productos = await Producto.findAll();
    res.json(productos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener productos" });
  }
};

export const deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;
    // destroy retorna el número de filas eliminadas
    const filasEliminadas = await Producto.destroy({ where: { producto_id: id } });

    if (filasEliminadas === 0) {
        return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ msg: "Producto eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
};
