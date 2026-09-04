const { Pool } = require('pg')

let pool = null

function boolFromEnv(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  return ['true', '1', 'yes', 'y'].includes(String(value).trim().toLowerCase())
}

function intFromEnv(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildPoolConfig() {
  const sslEnabled = boolFromEnv(process.env.PGSSL, false)
  const ssl = sslEnabled ? { rejectUnauthorized: false } : undefined

  const poolConfig = {
    max: intFromEnv(process.env.PGPOOL_MAX, 10),
    idleTimeoutMillis: intFromEnv(process.env.PG_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMillis: intFromEnv(process.env.PG_CONNECTION_TIMEOUT_MS, 5000),
  }

  if (process.env.DATABASE_URL) {
    return {
      ...poolConfig,
      connectionString: process.env.DATABASE_URL,
      ssl,
    }
  }

  return {
    ...poolConfig,
    host: process.env.PGHOST || 'localhost',
    port: intFromEnv(process.env.PGPORT, 5432),
    database: process.env.PGDATABASE || 'lululemonvog',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    ssl,
  }
}

function getPool() {
  if (!pool) {
    pool = new Pool(buildPoolConfig())
    pool.on('error', (error) => {
      console.error('Unexpected PostgreSQL pool error:', error.message)
    })
  }
  return pool
}

async function connectDB() {
  const activePool = getPool()
  const client = await activePool.connect()
  try {
    await client.query('SELECT 1')
  } finally {
    client.release()
  }
  const target = process.env.DATABASE_URL
    ? 'DATABASE_URL'
    : `${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'lululemonvog'}`
  console.log(`PostgreSQL connected: ${target}`)
  return activePool
}

async function query(text, params) {
  const activePool = getPool()
  return activePool.query(text, params)
}

async function withTransaction(callback) {
  const activePool = getPool()
  const client = await activePool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function healthCheck() {
  try {
    await query('SELECT 1')
    return { ok: true, database: 'connected', databaseType: 'postgresql' }
  } catch (error) {
    return { ok: false, database: 'disconnected', databaseType: 'postgresql' }
  }
}

async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}

module.exports = {
  connectDB,
  getPool,
  query,
  withTransaction,
  healthCheck,
  closePool,
}
