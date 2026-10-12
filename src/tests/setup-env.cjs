// Las pruebas no se conectan a ninguna base: los modelos se simulan.
// Sequelize solo necesita una URL con formato valido para poder crearse al importar los modelos.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://pruebas:pruebas@127.0.0.1:5432/pruebas';
}
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'secreto-solo-para-pruebas';
