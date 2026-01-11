/**
 * Database Migration Script
 * Creates the users table with all required columns
 */

import { pool, query } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('Starting database migration...');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        enhancements_used INTEGER DEFAULT 0,
        enhancements_limit INTEGER DEFAULT 10,
        subscription_status VARCHAR(50) DEFAULT 'freemium',
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMP,
        last_reset_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index on email for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);

    // Create index on stripe_customer_id for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id)
      WHERE stripe_customer_id IS NOT NULL
    `);

    await client.query('COMMIT');
    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
