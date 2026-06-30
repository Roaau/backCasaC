require('dotenv').config();

const supabaseUrl = process.env.DATABASE_URL;

const shared = supabaseUrl
  ? {
      url: supabaseUrl,
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false }
      }
    }
  : {
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host:     process.env.DB_HOST || '127.0.0.1',
      port:     process.env.DB_PORT || 5432,
      dialect:  'postgres',
      logging:  false,
    };

module.exports = {
  development: shared,
  production: shared,
};
