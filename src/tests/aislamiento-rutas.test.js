// Revisa, ruta por ruta, que ningun modulo quede expuesto sin sesion o sin el rol correcto.
// Lee server.js y las rutas como texto: si alguien monta un modulo nuevo sin verificarToken, esta prueba falla.
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const montajes = [...server.matchAll(/app\.use\(\s*"(\/api\/[^"]+)"\s*,([^)]*)\)/g)]
  .map(m => ({ ruta: m[1], cadena: m[2] }))
  .filter(m => !m.cadena.includes('Limit') || m.cadena.includes('Routes'));

// Rutas que son publicas a proposito
const PUBLICAS = ['/api/auth', '/api/escaner', '/api/planes'];
const SOLO_ADMIN = ['/api/reportes', '/api/configuracion', '/api/empresas'];

describe('Aislamiento - montaje de rutas', () => {
  test('se encontraron los modulos montados', () => {
    expect(montajes.length).toBeGreaterThan(20);
  });

  test.each(montajes.filter(m => !PUBLICAS.includes(m.ruta) && /Routes/.test(m.cadena)).map(m => [m.ruta, m.cadena]))(
    '%s exige sesion (verificarToken)', (ruta, cadena) => {
      expect(cadena).toContain('verificarToken');
    });

  test.each(SOLO_ADMIN)('%s exige rol administrador', (ruta) => {
    const m = montajes.find(x => x.ruta === ruta);
    expect(m).toBeDefined();
    expect(m.cadena).toContain('verificarAdmin');
  });

  test('superadmin exige verificarSuperAdmin', () => {
    const m = montajes.find(x => x.ruta === '/api/superadmin');
    expect(m.cadena).toContain('verificarToken');
    expect(m.cadena).toContain('verificarSuperAdmin');
  });

  test('las rutas de auth que cambian la cuenta exigen sesion', () => {
    const auth = fs.readFileSync(path.join(__dirname, '..', 'routes', 'authRoutes.js'), 'utf8');
    for (const r of ['/perfil', '/negocio', '/cerrar-sesiones']) {
      const linea = auth.split('\n').find(l => l.includes(`"${r}"`));
      expect(linea).toContain('verificarToken');
    }
  });

  test('uso de pantallas exige sesion', () => {
    expect(server).toMatch(/app\.post\("\/api\/uso",\s*verificarToken/);
  });
});

describe('Aislamiento - consultas por empresa', () => {
  // Cada consulta SQL "a mano" de estos controladores debe filtrar por empresa o sucursal
  const ARCHIVOS = ['bitacoraController.js', 'ventasController.js', 'cajaController.js', 'devolucionController.js', 'reportesController.js'];
  test.each(ARCHIVOS)('%s filtra por empresa o sucursal en sus SELECT', (archivo) => {
    const codigo = fs.readFileSync(path.join(__dirname, '..', 'controllers', archivo), 'utf8');
    const consultas = [...codigo.matchAll(/sequelize\.query\(\s*`([\s\S]*?)`/g)].map(m => m[1]).filter(sql => /^\s*SELECT/i.test(sql));
    for (const sql of consultas) {
      expect(/empresa_id|sucursal_id|caja_id|venta_id|\$\{clausula\}|\$\{filtro|\$\{where\}/i.test(sql)).toBe(true);
    }
  });
});
