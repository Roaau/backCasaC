import sequelize from '../config/database.js';
import MovimientoInventario from '../models/MovimientoInventario.js';
// ⚠️ Asegúrate de importar el modelo Producto correctamente (CajaModel.js o Producto.js)
import Producto from '../models/Producto.js'; 

export const registrarMovimiento = async (req, res) => {
  // Iniciamos transacción para que no queden datos a medias
  const t = await sequelize.transaction();

  try {
    const { producto_id, usuario_id, tipo_movimiento, cantidad, observaciones } = req.body;

    // 1. Validaciones básicas
    if (!producto_id || !cantidad || !tipo_movimiento) {
        throw new Error("Faltan datos (producto, cantidad o tipo)");
    }

    // 2. Obtener el producto actual para saber su stock antes de modificar
    const producto = await Producto.findByPk(producto_id, { transaction: t });
    if (!producto) {
        throw new Error("Producto no encontrado");
    }

    const stockAnterior = producto.stock_actual;
    let stockNuevo = 0;

    // 3. Calcular el nuevo stock según el tipo de movimiento
    if (tipo_movimiento === 'ENTRADA') {
        // Sumar (Compras, Devoluciones)
        stockNuevo = stockAnterior + parseInt(cantidad);
    } else {
        // Restar (Ajustes, Mermas, Uso Interno)
        // Validamos que no quede negativo (opcional)
        if (stockAnterior < cantidad) {
             throw new Error(`Stock insuficiente. Tienes ${stockAnterior} y quieres restar ${cantidad}`);
        }
        stockNuevo = stockAnterior - parseInt(cantidad);
    }

    // 4. Actualizar la tabla PRODUCTOS
    await producto.update({ stock_actual: stockNuevo }, { transaction: t });

    // 5. Guardar el historial en MOVIMIENTOS_INVENTARIO
    await MovimientoInventario.create({
        producto_id,
        usuario_id,
        tipo_movimiento,
        cantidad: parseInt(cantidad),
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        observaciones: observaciones || '',
        fecha: new Date()
    }, { transaction: t });

    // 6. Confirmar todo
    await t.commit();
    
    res.json({ 
        mensaje: 'Inventario actualizado con éxito', 
        nuevo_stock: stockNuevo 
    });

  } catch (error) {
    // Si algo falla, deshacemos cambios
    await t.rollback();
    console.error("Error en inventario:", error);
    res.status(500).json({ error: error.message });
  }
};