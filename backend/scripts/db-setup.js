/**
 * Production Database Setup Script
 *
 * Creates application indexes and validates the production database basics.
 * Usage: npm run db:setup
 */

require('dotenv').config();
const mongoose = require('mongoose');

const models = [
  { name: 'Announcement', model: require('../models/Announcement') },
  { name: 'Attendance', model: require('../models/Attendance') },
  { name: 'Candidate', model: require('../models/Candidate') },
  { name: 'Document', model: require('../models/Document') },
  { name: 'Employee', model: require('../models/Employee') },
  { name: 'Goal', model: require('../models/Goal') },
  { name: 'Job', model: require('../models/Job') },
  { name: 'KPI', model: require('../models/KPI') },
  { name: 'Leave', model: require('../models/Leave') },
  { name: 'Notification', model: require('../models/Notification') },
  { name: 'OKR', model: require('../models/OKR') },
  { name: 'Onboarding', model: require('../models/Onboarding') },
  { name: 'Payroll', model: require('../models/Payroll') },
  { name: 'PerformanceReview', model: require('../models/PerformanceReview') },
  { name: 'Settings', model: require('../models/Settings') },
  { name: 'Task', model: require('../models/Task') },
  { name: 'User', model: require('../models/User') },
];

const MONGODB_URI = process.env.MONGODB_URI;
const isProduction = process.env.NODE_ENV === 'production';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const log = {
  info: (message) => console.log(`${colors.cyan}[INFO]${colors.reset} ${message}`),
  success: (message) => console.log(`${colors.green}[OK]${colors.reset} ${message}`),
  warn: (message) => console.log(`${colors.yellow}[WARN]${colors.reset} ${message}`),
  error: (message) => console.log(`${colors.red}[ERROR]${colors.reset} ${message}`),
};

const maskMongoUri = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');

function validateEnvironment() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Set it before running database setup.');
  }

  if (isProduction && /localhost|127\.0\.0\.1/.test(MONGODB_URI) && process.env.ALLOW_LOCAL_DB_IN_PRODUCTION !== 'true') {
    throw new Error('Production setup is pointing at a local MongoDB URI. Set ALLOW_LOCAL_DB_IN_PRODUCTION=true only if this is intentional.');
  }

  if (isProduction && !process.env.JWT_SECRET) {
    log.warn('JWT_SECRET is not set. Database setup can continue, but production API startup should not.');
  }
}

async function connectDB() {
  log.info('Connecting to MongoDB...');
  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);

  await mongoose.connect(MONGODB_URI, {
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20),
    minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 0),
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000),
    socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45000),
  });

  await mongoose.connection.db.admin().ping();
  log.success(`Connected to ${maskMongoUri(MONGODB_URI)}`);
}

async function createIndexes() {
  log.info('Creating indexes...');

  let failures = 0;
  for (const { name, model } of models) {
    try {
      await model.createIndexes();
      log.success(`${name} indexes are ready`);
    } catch (error) {
      failures += 1;
      log.error(`${name} index setup failed: ${error.message}`);
    }
  }

  if (failures > 0) {
    throw new Error(`${failures} model(s) failed index setup`);
  }
}

async function validateSettings() {
  const Settings = mongoose.model('Settings');
  const settings = await Settings.getSettings();
  log.success(`Settings document is ready for ${settings.companyName}`);
}

async function getCollectionStats() {
  log.info('Collection statistics:');
  console.log('');
  console.log('  Collection          Documents  Indexes');
  console.log('  ------------------  ---------  -------');

  for (const { model } of models) {
    const collectionName = model.collection.name;
    const collection = mongoose.connection.db.collection(collectionName);

    try {
      const [documents, indexes] = await Promise.all([
        collection.countDocuments(),
        collection.indexes(),
      ]);

      console.log(`  ${collectionName.padEnd(18)}  ${String(documents).padStart(9)}  ${String(indexes.length).padStart(7)}`);
    } catch {
      console.log(`  ${collectionName.padEnd(18)}  not created`);
    }
  }

  console.log('');
}

async function main() {
  console.log('');
  console.log('Sobat HR - Production Database Setup');
  console.log('====================================');
  console.log('');

  try {
    validateEnvironment();
    await connectDB();
    await createIndexes();
    await validateSettings();
    await getCollectionStats();

    log.success('Database setup completed successfully.');
  } catch (error) {
    log.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    log.info('Disconnected from MongoDB');
  }
}

main();
