// Reference: javascript_database blueprint
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
});

// Handle pool errors to prevent app crashes
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client:', err);
  // Don't crash the app - let the pool handle reconnection
});

// Set statement timeout for all connections
pool.on('connect', (client) => {
  // Set a 30-second statement timeout to prevent queries from hanging
  client.query('SET statement_timeout = 30000').catch(err => {
    console.error('Failed to set statement timeout:', err);
  });
});

export const db = drizzle({ client: pool, schema });
