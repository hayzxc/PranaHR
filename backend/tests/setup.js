const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

// Set test environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';

// Direct tests to the test database
process.env.DATABASE_URL = 'postgresql://sobathr:password@localhost:5432/sobathr_test?schema=public';

let prisma;

beforeAll(async () => {
    // Run db push to sync the test database schema
    try {
        execSync('npx prisma db push --skip-generate --accept-data-loss', {
            env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
            stdio: 'inherit'
        });
    } catch (err) {
        console.error('Error syncing test database schema:', err);
    }
    prisma = new PrismaClient();
});

afterAll(async () => {
    if (prisma) {
        await prisma.$disconnect();
    }
});

afterEach(async () => {
    if (prisma) {
        // Clean up database tables between tests
        const tablenames = await prisma.$queryRaw`
            SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations'
        `;
        
        for (const { tablename } of tablenames) {
            try {
                await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
            } catch (error) {
                // Ignore errors
            }
        }
    }
});
