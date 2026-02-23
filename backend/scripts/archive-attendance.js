/**
 * Archive Old Attendance Records
 * Moves attendance records older than specified months to an archive collection
 * 
 * Usage: node scripts/archive-attendance.js [months]
 * Example: node scripts/archive-attendance.js 24  (archives records older than 24 months)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sobat-hr';
const DEFAULT_MONTHS = 24; // Default: archive records older than 2 years

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
};

async function confirmAction(prompt) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

async function archiveAttendance(months) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);

    console.log(`\n${colors.cyan}Archive Settings:${colors.reset}`);
    console.log(`  - Cutoff date: ${cutoffDate.toISOString().split('T')[0]}`);
    console.log(`  - Archiving records older than ${months} months\n`);

    // Count records to archive
    const attendanceCollection = mongoose.connection.db.collection('attendances');
    const recordCount = await attendanceCollection.countDocuments({
        date: { $lt: cutoffDate }
    });

    if (recordCount === 0) {
        console.log(`${colors.green}✓${colors.reset} No records to archive`);
        return;
    }

    console.log(`Found ${colors.yellow}${recordCount}${colors.reset} records to archive`);

    // Confirm before proceeding
    const confirmed = await confirmAction('\nProceed with archiving? (y/n): ');

    if (!confirmed) {
        console.log('\nArchive cancelled');
        return;
    }

    console.log('\nArchiving...');

    // Create archive collection name with timestamp
    const archiveCollectionName = `attendances_archive_${new Date().toISOString().slice(0, 7).replace('-', '_')}`;

    // Move records to archive collection using aggregation
    await attendanceCollection.aggregate([
        { $match: { date: { $lt: cutoffDate } } },
        { $out: archiveCollectionName }
    ]).toArray();

    console.log(`  ${colors.green}✓${colors.reset} Records copied to: ${archiveCollectionName}`);

    // Delete archived records from main collection
    const deleteResult = await attendanceCollection.deleteMany({
        date: { $lt: cutoffDate }
    });

    console.log(`  ${colors.green}✓${colors.reset} Deleted ${deleteResult.deletedCount} records from main collection`);

    // Create index on archive collection
    const archiveCollection = mongoose.connection.db.collection(archiveCollectionName);
    await archiveCollection.createIndex({ employeeId: 1, date: 1 });
    await archiveCollection.createIndex({ date: -1 });

    console.log(`  ${colors.green}✓${colors.reset} Created indexes on archive collection`);

    console.log(`\n${colors.green}Archive completed successfully!${colors.reset}\n`);
}

async function listArchives() {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const archives = collections.filter(c => c.name.startsWith('attendances_archive_'));

    if (archives.length === 0) {
        console.log('No archive collections found');
        return;
    }

    console.log(`\n${colors.cyan}Existing archives:${colors.reset}\n`);

    for (const archive of archives) {
        const collection = mongoose.connection.db.collection(archive.name);
        const count = await collection.countDocuments();
        const stats = await collection.stats();

        console.log(`  - ${archive.name}`);
        console.log(`    Documents: ${count}`);
        console.log(`    Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const months = parseInt(args[0]) || DEFAULT_MONTHS;

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   Attendance Archive Utility           ║');
    console.log('╚════════════════════════════════════════╝');

    try {
        await mongoose.connect(MONGODB_URI);
        console.log(`\n${colors.green}✓${colors.reset} Connected to MongoDB`);

        await listArchives();
        await archiveAttendance(months);

    } catch (error) {
        console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

main();
