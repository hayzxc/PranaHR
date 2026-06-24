/**
 * Database Health Check Script
 *
 * Checks connectivity, indexes, duplicate keys, and common orphaned records.
 * Usage: npm run db:health
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

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const ok = (message) => console.log(`  ${colors.green}[OK]${colors.reset} ${message}`);
const warn = (message) => console.log(`  ${colors.yellow}[WARN]${colors.reset} ${message}`);
const fail = (message) => console.log(`  ${colors.red}[FAIL]${colors.reset} ${message}`);
const section = (message) => console.log(`\n${colors.cyan}${message}${colors.reset}\n`);

async function checkOrphanedRecords() {
  section('Checking referenced records');
  let issues = 0;

  const checks = [
    {
      label: 'employees without linked users',
      collection: mongoose.model('Employee'),
      localField: 'userId',
      foreignCollection: 'users',
    },
    {
      label: 'attendance records without employees',
      collection: mongoose.model('Attendance'),
      localField: 'employeeId',
      foreignCollection: 'employees',
    },
    {
      label: 'leave records without employees',
      collection: mongoose.model('Leave'),
      localField: 'employeeId',
      foreignCollection: 'employees',
    },
    {
      label: 'payroll records without employees',
      collection: mongoose.model('Payroll'),
      localField: 'employee',
      foreignCollection: 'employees',
    },
  ];

  for (const check of checks) {
    const result = await check.collection.aggregate([
      {
        $lookup: {
          from: check.foreignCollection,
          localField: check.localField,
          foreignField: '_id',
          as: 'linkedRecord',
        },
      },
      { $match: { linkedRecord: { $size: 0 } } },
      { $count: 'count' },
    ]);

    const count = result[0]?.count || 0;
    if (count > 0) {
      fail(`${count} ${check.label}`);
      issues += 1;
    } else {
      ok(`No ${check.label}`);
    }
  }

  return issues;
}

async function checkDuplicateKeys() {
  section('Checking duplicate unique keys');
  let issues = 0;

  const checks = [
    { label: 'user emails', model: mongoose.model('User'), field: 'email' },
    { label: 'employee emails', model: mongoose.model('Employee'), field: 'email' },
    { label: 'employee IDs', model: mongoose.model('Employee'), field: 'employeeId' },
  ];

  for (const check of checks) {
    const duplicates = await check.model.aggregate([
      { $match: { [check.field]: { $exists: true, $ne: null } } },
      { $group: { _id: `$${check.field}`, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 5 },
    ]);

    if (duplicates.length > 0) {
      fail(`Duplicate ${check.label}: ${duplicates.map((item) => item._id).join(', ')}`);
      issues += 1;
    } else {
      ok(`No duplicate ${check.label}`);
    }
  }

  return issues;
}

async function checkIndexes() {
  section('Checking model indexes');
  let issues = 0;

  for (const { name, model } of models) {
    const diff = await model.diffIndexes();
    const missing = diff.toCreate.length;
    const extra = diff.toDrop.length;

    if (missing > 0) {
      fail(`${name} is missing ${missing} index(es). Run npm run db:setup.`);
      issues += 1;
    } else if (extra > 0) {
      warn(`${name} has ${extra} extra index(es). Review before dropping anything in production.`);
    } else {
      ok(`${name} indexes match the schema`);
    }
  }

  return issues;
}

async function checkPayrollCalculations() {
  section('Checking payroll calculations');

  const result = await mongoose.model('Payroll').aggregate([
    {
      $addFields: {
        calculatedNet: {
          $subtract: [
            {
              $add: [
                '$basicSalary',
                { $ifNull: ['$earnings.overtime', 0] },
                { $ifNull: ['$earnings.bonus', 0] },
                { $ifNull: ['$earnings.allowances', 0] },
                { $ifNull: ['$earnings.transport', 0] },
                { $ifNull: ['$earnings.meal', 0] },
                { $ifNull: ['$earnings.other', 0] },
              ],
            },
            {
              $add: [
                { $ifNull: ['$deductions.tax', 0] },
                { $ifNull: ['$deductions.bpjs', 0] },
                { $ifNull: ['$deductions.pension', 0] },
                { $ifNull: ['$deductions.loan', 0] },
                { $ifNull: ['$deductions.absence', 0] },
                { $ifNull: ['$deductions.other', 0] },
              ],
            },
          ],
        },
      },
    },
    { $match: { $expr: { $ne: ['$netPay', '$calculatedNet'] } } },
    { $count: 'count' },
  ]);

  const count = result[0]?.count || 0;
  if (count > 0) {
    fail(`${count} payroll records have calculation mismatches`);
    return 1;
  }

  ok('Payroll calculations are consistent');
  return 0;
}

async function main() {
  console.log('');
  console.log('Sobat HR - Database Health Check');
  console.log('================================');

  if (!MONGODB_URI) {
    fail('MONGODB_URI is required');
    process.exit(1);
  }

  try {
    mongoose.set('autoIndex', false);
    mongoose.set('autoCreate', false);

    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20),
      minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 0),
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000),
      socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45000),
    });

    await mongoose.connection.db.admin().ping();
    ok('Connected to MongoDB');

    let totalIssues = 0;
    totalIssues += await checkIndexes();
    totalIssues += await checkDuplicateKeys();
    totalIssues += await checkOrphanedRecords();
    totalIssues += await checkPayrollCalculations();

    console.log('');
    if (totalIssues === 0) {
      ok('Database health check passed');
    } else {
      fail(`Database health check found ${totalIssues} issue(s)`);
      process.exitCode = 1;
    }
  } catch (error) {
    fail(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
