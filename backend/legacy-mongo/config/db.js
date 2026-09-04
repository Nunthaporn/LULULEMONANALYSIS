const mongoose = require('mongoose')

async function connectDB() {
  const mongoUri = process.env.MONGO_URI

  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined.')
  }

  await mongoose.connect(mongoUri)
  console.log(`MongoDB connected: ${mongoose.connection.name}`)
}

module.exports = connectDB
