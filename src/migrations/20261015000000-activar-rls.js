'use strict';

// Cierra la API publica de Supabase (PostgREST): RLS activado en todas las tablas de public, sin politicas.
// El backend se conecta como postgres (bypassrls), asi que no le afecta.
// IMPORTANTE: toda tabla nueva debe activar RLS tambien (ALTER TABLE ... ENABLE ROW LEVEL SECURITY).

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE t record;
      BEGIN
        FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
          EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
        END LOOP;
      END $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE t record;
      BEGIN
        FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
          EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.tablename);
        END LOOP;
      END $$;
    `);
  }
};
