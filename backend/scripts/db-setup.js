/**
 * Production Database Setup Script
 * Run this script to set up all indexes and validate the database
 * 
 * Usage: node scripts/db-setup.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import all models to register them
const User = require('../models/User');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Payroll = require('../models/Payroll');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Onboarding = require('../models/Onboarding');
const Goal = require('../models/Goal');
const PerformanceReview = require('../models/PerformanceReview');
const Document = require('../models/Document');
const Settings = require('../models/Settings');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sobat-hr';

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
};

const log = {
    info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
};

async function connectDB() {
    log.info('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    log.success(`Connected to: ${MONGODB_URI.replace(/\/\/.*@/, '//*****@')}`);
}

async function createIndexes() {
    log.info('Creating indexes...');

    const models = [
        { name: 'User', model: User },
        { name: 'Employee', model: Employee },
        { name: 'Attendance', model: Attendance },
        { name: 'Leave', model: Leave },
        { name: 'Payroll', model: Payroll },
        { name: 'Job', model: Job },
        { name: 'Candidate', model: Candidate },
        { name: 'Onboarding', model: Onboarding },
        { name: 'Goal', model: Goal },
        { name: 'PerformanceReview', model: PerformanceReview },
        { name: 'Document', model: Document },
        { name: 'Settings', model: Settings },
    ];

    for (const { name, model } of models) {
        try {
            await model.createIndexes();
            log.success(`  ✓ ${name} indexes created`);
        } catch (error) {
            log.error(`  ✗ ${name}: ${error.message}`);
        }
    }
}

async function getCollectionStats() {
    log.info('Collection statistics:');

    const collections = [
        'users', 'employees', 'attendances', 'leaves', 'payrolls',
        'jobs', 'candidates', 'onboardings', 'goals', 'performancereviews', 'documents', 'settings'
    ];

    console.log('\n  Collection            | Documents | Indexes | Size');
    console.log('  ----------------------|-----------|---------|----------');

    for (const collName of collections) {
        try {
            const collection = mongoose.connection.db.collection(collName);
            const stats = await collection.stats();
            const indexes = await collection.indexes();

            const docCount = stats.count.toString().padStart(9);
            const indexCount = indexes.length.toString().padStart(7);
            const size = formatBytes(stats.size).padStart(10);

            console.log(`  ${collName.padEnd(22)}| ${docCount} | ${indexCount} | ${size}`);
        } catch (error) {
            console.log(`  ${collName.padEnd(22)}| (not created yet)`);
        }
    }
    console.log('');
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function validateSettings() {
    log.info('Validating settings...');

    try {
        const settings = await Settings.getSettings();
        log.success(`  ✓ Settings document exists (Company: ${settings.companyName})`);
    } catch (error) {
        log.error(`  ✗ Settings: ${error.message}`);
    }
}

async function listIndexes() {
    log.info('Current indexes by collection:\n');

    const collections = await mongoose.connection.db.listCollections().toArray();

    for (const collInfo of collections) {
        const collection = mongoose.connection.db.collection(collInfo.name);
        const indexes = await collection.indexes();

        console.log(`  ${colors.cyan}${collInfo.name}${colors.reset}`);
        for (const idx of indexes) {
            const keys = Object.keys(idx.key).join(', ');
            const unique = idx.unique ? ' (unique)' : '';
            console.log(`    - ${idx.name}: [${keys}]${unique}`);
        }
        console.log('');
    }
}

async function main() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   Sobat HR - Database Setup Script     ║');
    console.log('╚════════════════════════════════════════╝\n');

    try {
        await connectDB();
        console.log('');

        await createIndexes();
        console.log('');

        await validateSettings();
        console.log('');

        await getCollectionStats();

        // Uncomment to see all indexes
        // await listIndexes();

        log.success('Database setup completed successfully!\n');

    } catch (error) {
        log.error(`Setup failed: ${error.message}`);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        log.info('Disconnected from MongoDB');
    }
}

main();
