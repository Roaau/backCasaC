# Cómo agregar un giro de negocio

Un "giro" decide qué campos pide el alta de productos (marca, talla, caducidad…), qué categorías se sugieren, qué unidades se ofrecen y en qué nivel de precio cae el plan.

1. **Back — `src/utils/giros.js`**: agrega la clave y el nombre en `GIROS`:
   ```js
   cafeteria: "Cafetería",
   ```
   La clave va en minúsculas, sin espacios ni acentos. Es la que se guarda en `empresas.giro`.
2. **Back — `src/utils/planes.js`**: agrega la clave al nivel de precio que le toque en `NIVELES` (`giros: [...]`). Es obligatorio: `planes.test.js` falla si un giro no tiene nivel.
3. **Front — `src/app/core/giros.ts`**: agrega su `GiroConfig` con la **misma clave**:
   ```ts
   { clave: 'cafeteria', nombre: 'Cafetería', campos: ['fecha_caducidad'], categorias: ['Café', 'Pan', 'Bebidas frías'], unidades: ['pieza', 'litro'] }
   ```
4. **Catálogo base (opcional)**: en el panel superadmin → Catálogos base → sube un Excel con el giro nuevo. Los negocios de ese giro lo verán en Inventario → Catálogo.
5. Corre `npm test` (back) y `npm run build` (front). `planes.test.js` revisa que todos los giros tengan precio.
