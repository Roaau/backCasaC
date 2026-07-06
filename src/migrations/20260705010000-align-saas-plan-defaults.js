export async function up(queryInterface, Sequelize) {
  await queryInterface.changeColumn('empresas', 'precio_mensual', {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 700
  });

  await queryInterface.changeColumn('empresas', 'limite_usuarios', {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 5
  });
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.changeColumn('empresas', 'precio_mensual', {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  });

  await queryInterface.changeColumn('empresas', 'limite_usuarios', {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 2
  });
}
