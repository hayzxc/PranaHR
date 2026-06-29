const request = require('supertest');
const express = require('express');
const prisma = require('../../lib/prisma').default;

let app;
let adminToken;
let employeeToken;
let adminUser;
let employeeUser;

beforeAll(async () => {
    const authRoutes = require('../../routes/auth');
    const employeeRoutes = require('../../routes/employees');
    const { errorHandler, notFoundHandler } = require('../../middleware/errorHandler');

    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/employees', employeeRoutes);
    app.use(notFoundHandler);
    app.use(errorHandler);
});

beforeEach(async () => {
    // Create admin user and get token
    const adminRes = await request(app)
        .post('/api/auth/register')
        .send({
            email: 'admin@test.com',
            password: 'password123',
            role: 'admin',
        });
    adminToken = adminRes.body.data.token;
    adminUser = adminRes.body.data.user;

    // Create employee user and get token
    const empRes = await request(app)
        .post('/api/auth/register')
        .send({
            email: 'employee@test.com',
            password: 'password123',
            role: 'employee',
            name: 'Test Employee',
            department: 'Sertifikasi',
            position: 'Staff',
        });
    employeeToken = empRes.body.data.token;
    employeeUser = empRes.body.data.user;
});

describe('Employee Routes', () => {
    describe('GET /api/employees', () => {
        it('should return employee list for admin', async () => {
            const res = await request(app)
                .get('/api/employees')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should reject employee role access', async () => {
            const res = await request(app)
                .get('/api/employees')
                .set('Authorization', `Bearer ${employeeToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject unauthenticated access', async () => {
            const res = await request(app)
                .get('/api/employees');

            expect(res.status).toBe(401);
        });

        it('should support pagination', async () => {
            const res = await request(app)
                .get('/api/employees?page=1&limit=5')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.pagination).toBeDefined();
            expect(res.body.pagination.page).toBe(1);
            expect(res.body.pagination.limit).toBe(5);
        });
    });

    describe('POST /api/employees', () => {
        it('should create a new employee (admin)', async () => {
            const res = await request(app)
                .post('/api/employees')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'newemp@test.com',
                    password: 'password123',
                    name: 'New Employee',
                    department: 'Finance',
                    position: 'Accountant',
                    salary: 5000000,
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('New Employee');
            expect(res.body.data.department).toBe('Finance');
        });

        it('should reject duplicate email', async () => {
            // First create
            await request(app)
                .post('/api/employees')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'dup-emp@test.com',
                    name: 'Dup Employee',
                    department: 'Finance',
                    position: 'Staff',
                    salary: 4000000,
                });

            // Try duplicate
            const res = await request(app)
                .post('/api/employees')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'dup-emp@test.com',
                    name: 'Dup Employee 2',
                    department: 'Finance',
                    position: 'Staff',
                    salary: 4000000,
                });

            expect(res.status).toBe(409);
        });

        it('should reject employee role from creating', async () => {
            const res = await request(app)
                .post('/api/employees')
                .set('Authorization', `Bearer ${employeeToken}`)
                .send({
                    email: 'blocked@test.com',
                    name: 'Blocked',
                    department: 'Finance',
                    position: 'Staff',
                    salary: 3000000,
                });

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/employees/:id', () => {
        it('should get employee by ID (admin)', async () => {
            const employee = await prisma.employee.findUnique({ where: { email: 'employee@test.com' } });

            const res = await request(app)
                .get(`/api/employees/${employee.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.email).toBe('employee@test.com');
        });

        it('should return 404 for non-existent employee', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';

            const res = await request(app)
                .get(`/api/employees/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });

        it('should return 400 for invalid ID format', async () => {
            const res = await request(app)
                .get('/api/employees/invalid-id')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
        });
    });

    describe('PUT /api/employees/:id', () => {
        it('should update employee (admin)', async () => {
            const employee = await prisma.employee.findUnique({ where: { email: 'employee@test.com' } });

            const res = await request(app)
                .put(`/api/employees/${employee.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    position: 'Senior Staff',
                    salary: 8000000,
                });

            expect(res.status).toBe(200);
            expect(res.body.data.position).toBe('Senior Staff');
            expect(res.body.data.salary).toBe(8000000);
        });

        it('should return 404 for non-existent employee', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';

            const res = await request(app)
                .put(`/api/employees/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ position: 'Updated' });

            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/employees/:id', () => {
        it('should terminate employee (admin only)', async () => {
            const employee = await prisma.employee.findUnique({ where: { email: 'employee@test.com' } });

            const res = await request(app)
                .delete(`/api/employees/${employee.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);

            // Verify employee is terminated
            const terminated = await prisma.employee.findUnique({ where: { id: employee.id } });
            expect(terminated.status).toBe('terminated');
        });

        it('should reject non-admin from deleting', async () => {
            const employee = await prisma.employee.findUnique({ where: { email: 'employee@test.com' } });

            const res = await request(app)
                .delete(`/api/employees/${employee.id}`)
                .set('Authorization', `Bearer ${employeeToken}`);

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/employees/stats/summary', () => {
        it('should return employee statistics for admin', async () => {
            const res = await request(app)
                .get('/api/employees/stats/summary')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.totalEmployees).toBeDefined();
            expect(res.body.data.departments).toBeDefined();
        });

        it('should reject employee role', async () => {
            const res = await request(app)
                .get('/api/employees/stats/summary')
                .set('Authorization', `Bearer ${employeeToken}`);

            expect(res.status).toBe(403);
        });
    });
});
