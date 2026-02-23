/**
 * Database Health Check Script
 * Run this script to check database health and identify issues
 * 
 * Usage: node scripts/db-health.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Payroll = require('../models/Payroll');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sobat-hr';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
};

async function checkOrphanedRecords() {
    console.log('\n📋 Checking for orphaned records...\n');

    let issues = 0;

    // Check employees without users
    const employeesWithoutUsers = await Employee.aggregate([
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user'
            }
        },
        { $match: { user: { $size: 0 } } },
        { $count: 'count' }
    ]);

    const orphanedEmployees = employeesWithoutUsers[0]?.count || 0;
    if (orphanedEmployees > 0) {
        console.log(`  ${colors.red}✗${colors.reset} ${orphanedEmployees} employees without linked users`);
        issues++;
    } else {
        console.log(`  ${colors.green}✓${colors.reset} All employees have linked users`);
    }

    // Check attendance records without employees
    const attendanceWithoutEmployees = await Attendance.aggregate([
        {
            $lookup: {
                from: 'employees',
                localField: 'employeeId',
                foreignField: '_id',
                as: 'employee'
            }
        },
        { $match: { employee: { $size: 0 } } },
        { $count: 'count' }
    ]);

    const orphanedAttendance = attendanceWithoutEmployees[0]?.count || 0;
    if (orphanedAttendance > 0) {
        console.log(`  ${colors.red}✗${colors.reset} ${orphanedAttendance} attendance records without employees`);
        issues++;
    } else {
        console.log(`  ${colors.green}✓${colors.reset} All attendance records have valid employees`);
    }

    // Check leaves without employees
    const leavesWithoutEmployees = await Leave.aggregate([
        {
            $lookup: {
                from: 'employees',
                localField: 'employeeId',
                foreignField: '_id',
                as: 'employee'
            }
        },
        { $match: { employee: { $size: 0 } } },
        { $count: 'count' }
    ]);

    const orphanedLeaves = leavesWithoutEmployees[0]?.count || 0;
    if (orphanedLeaves > 0) {
        console.log(`  ${colors.red}✗${colors.reset} ${orphanedLeaves} leave records without employees`);
        issues++;
    } else {
        console.log(`  ${colors.green}✓${colors.reset} All leave records have valid employees`);
    }

    return issues;
}

async function checkDataIntegrity() {
    console.log('\n📋 Checking data integrity...\n');

    let issues = 0;

    // Check for duplicate emails in users
    const duplicateEmails = await User.aggregate([
        { $group: { _id: '$email', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
    ]);

    if (duplicateEmails.length > 0) {
        console.log(`  ${colors.red}✗${colors.reset} Found ${duplicateEmails.length} duplicate user emails`);
        issues++;
    } else {
        console.log(`  ${colors.green}✓${colors.reset} No duplicate user emails`);
    }

    // Check for inactive users with active employees
    const inactiveUsersWithActiveEmployees = await User.aggregate([
        { $match: { isActive: false } },
        {
            $lookup: {
                from: 'employees',
                localField: '_id',
                foreignField: 'userId',
                as: 'employee'
            }
        },
        { $unwind: '$employee' },
        { $match: { 'employee.status': 'active' } },
        { $count: 'count' }
    ]);

    const mismatchedStatus = inactiveUsersWithActiveEmployees[0]?.count || 0;
    if (mismatchedStatus > 0) {
        console.log(`  ${colors.yellow}⚠${colors.reset} ${mismatchedStatus} inactive users with active employee profiles`);
        issues++;
    } else {
        console.log(`  ${colors.green}✓${colors.reset} User/Employee status consistent`);
    }

    // Check payroll calculations
    const incorrectPayrolls = await Payroll.aggregate([
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
                                { $ifNull: ['$earnings.other', 0] }
                            ]
                        },
                        {
                            $add: [
                                { $ifNull: ['$deductions.tax', 0] },
                                { $ifNull: ['$deductions.bpjs', 0] },
                                { $ifNull: ['$deductions.pension', 0] },
                                { $ifNull: ['$deductions.loan', 0] },
                                { $ifNull: ['$deductions.absence', 0] },
                                { $ifNull: ['$deductions.other', 0] }
                            ]
                        }
                    ]
                }
            }
        },
        {
            $match: {
                $expr: { $ne: ['$netPay', '$calculatedNet'] }
            }
        },
        { $count: 'count' }
    ]);

    const badPayrolls = incorrectPayrolls[0]?.count || 0;
    if (badPayrolls > 0) {
        console.log(`  ${colors.yellow}⚠${colors.reset} ${badPayrolls} payroll records with calculation mismatches`);
        issues++;
    } else {
        console.log(`  ${colors.green}✓${colors.reset} All payroll calculations are correct`);
    }

    return issues;
}

async function getIndexUsage() {
    console.log('\n📋 Index usage analysis...\n');

    const collections = ['users', 'employees', 'attendances', 'leaves', 'payrolls'];

    for (const collName of collections) {
        try {
            const stats = await mongoose.connection.db.command({
                aggregate: collName,
                pipeline: [{ $indexStats: {} }],
                cursor: {}
            });

            console.log(`  ${colors.cyan}${collName}${colors.reset}`);

            for (const idx of stats.cursor.firstBatch) {
                const ops = idx.accesses.ops;
                const status = ops === 0 ? colors.yellow + '⚠' : colors.green + '✓';
                console.log(`    ${status}${colors.reset} ${idx.name}: ${ops} operations`);
            }
            console.log('');
        } catch (error) {
            console.log(`  ${collName}: Unable to get stats`);
        }
    }
}

async function main() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   Sobat HR - Database Health Check     ║');
    console.log('╚════════════════════════════════════════╝');

    try {
        await mongoose.connect(MONGODB_URI);
        console.log(`\n${colors.green}✓${colors.reset} Connected to MongoDB\n`);

        let totalIssues = 0;

        totalIssues += await checkOrphanedRecords();
        totalIssues += await checkDataIntegrity();
        await getIndexUsage();

        console.log('═══════════════════════════════════════════');
        if (totalIssues === 0) {
            console.log(`${colors.green}✓ Database health check passed!${colors.reset}`);
        } else {
            console.log(`${colors.yellow}⚠ Found ${totalIssues} issue(s) that may need attention${colors.reset}`);
        }
        console.log('═══════════════════════════════════════════\n');

    } catch (error) {
        console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

main();
