const mongoose = require('mongoose');

const maskMongoUri = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI is required');
    }

    if (process.env.NODE_ENV === 'production') {
      mongoose.set('autoIndex', false);
      mongoose.set('autoCreate', false);
    }

    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20),
      minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 0),
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000),
      socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45000),
    });

    console.log(`MongoDB Connected: ${conn.connection.host} (${maskMongoUri(mongoUri)})`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
