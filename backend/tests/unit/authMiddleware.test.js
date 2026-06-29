const jwt = require('jsonwebtoken');
const { auth, authorize, optionalAuth, authorizeOwnerOrAdmin } = require('../../middleware/auth');
const prisma = require('../../lib/prisma').default;

jest.mock('../../lib/prisma', () => ({
    __esModule: true,
    default: {
        user: {
            findUnique: jest.fn(),
        },
    },
}));

// Setup env for JWT
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';

function mockReq(overrides = {}) {
    return {
        header: jest.fn(),
        ...overrides,
    };
}

describe('Auth Middleware', () => {
    let testUser;
    let validToken;

    beforeEach(() => {
        jest.clearAllMocks();
        testUser = {
            id: 'test-user-id-123',
            email: 'auth-test@test.com',
            role: 'admin',
            isActive: true,
        };

        validToken = jwt.sign(
            { id: testUser.id, email: testUser.email, role: testUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' },
        );

        prisma.user.findUnique.mockResolvedValue(testUser);
    });

    describe('auth()', () => {
        it('should attach user to req with valid token', async () => {
            const req = mockReq();
            req.header.mockReturnValue(`Bearer ${validToken}`);
            const next = jest.fn();

            await auth(req, {}, next);

            expect(next).toHaveBeenCalledWith();
            expect(req.user).toBeDefined();
            expect(req.user.email).toBe('auth-test@test.com');
            expect(req.token).toBe(validToken);
            expect(req.userId).toBeDefined();
        });

        it('should call next with error when no auth header', async () => {
            const req = mockReq();
            req.header.mockReturnValue(undefined);
            const next = jest.fn();

            await auth(req, {}, next);

            expect(next).toHaveBeenCalled();
            const err = next.mock.calls[0][0];
            expect(err.statusCode).toBe(401);
        });

        it('should call next with error when header missing "Bearer "', async () => {
            const req = mockReq();
            req.header.mockReturnValue('InvalidHeader');
            const next = jest.fn();

            await auth(req, {}, next);

            expect(next).toHaveBeenCalled();
            const err = next.mock.calls[0][0];
            expect(err.statusCode).toBe(401);
        });

        it('should call next with error for invalid token', async () => {
            const req = mockReq();
            req.header.mockReturnValue('Bearer invalid.token.here');
            const next = jest.fn();

            await auth(req, {}, next);

            expect(next).toHaveBeenCalled();
            const err = next.mock.calls[0][0];
            expect(err.statusCode).toBe(401);
        });

        it('should call next with error for expired token', async () => {
            const expiredToken = jwt.sign(
                { id: testUser.id },
                process.env.JWT_SECRET,
                { expiresIn: '0s' },
            );
            const req = mockReq();
            req.header.mockReturnValue(`Bearer ${expiredToken}`);
            const next = jest.fn();

            // Small delay to ensure token expired
            await new Promise(resolve => setTimeout(resolve, 100));
            await auth(req, {}, next);

            expect(next).toHaveBeenCalled();
            const err = next.mock.calls[0][0];
            expect(err.statusCode).toBe(401);
        });

        it('should call next with error when user is not found', async () => {
            prisma.user.findUnique.mockResolvedValueOnce(null);
            const token = jwt.sign({ id: 'fake-id' }, process.env.JWT_SECRET, { expiresIn: '7d' });
            const req = mockReq();
            req.header.mockReturnValue(`Bearer ${token}`);
            const next = jest.fn();

            await auth(req, {}, next);

            expect(next).toHaveBeenCalled();
            const err = next.mock.calls[0][0];
            expect(err.statusCode).toBe(401);
        });

        it('should call next with error when user is deactivated', async () => {
            prisma.user.findUnique.mockResolvedValueOnce({ ...testUser, isActive: false });
            const req = mockReq();
            req.header.mockReturnValue(`Bearer ${validToken}`);
            const next = jest.fn();

            await auth(req, {}, next);

            expect(next).toHaveBeenCalled();
            const err = next.mock.calls[0][0];
            expect(err.statusCode).toBe(401);
            expect(err.message).toContain('deactivated');
        });
    });

    describe('authorize()', () => {
        it('should allow user with correct role', () => {
            const req = { user: { role: 'admin' } };
            const next = jest.fn();

            authorize('admin', 'hr')(req, {}, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('should deny user with wrong role', () => {
            const req = { user: { role: 'employee' } };
            const next = jest.fn();

            authorize('admin', 'hr')(req, {}, next);

            expect(next).toHaveBeenCalled();
            const err = next.mock.calls[0][0];
            expect(err.statusCode).toBe(403);
        });

        it('should return 401 when req.user is missing', () => {
            const req = {};
            const next = jest.fn();

            authorize('admin')(req, {}, next);

            expect(next).toHaveBeenCalled();
            const err = next.mock.calls[0][0];
            expect(err.statusCode).toBe(401);
        });
    });

    describe('optionalAuth()', () => {
        it('should attach user if valid token provided', async () => {
            const req = mockReq();
            req.header.mockReturnValue(`Bearer ${validToken}`);
            const next = jest.fn();

            await optionalAuth(req, {}, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeDefined();
            expect(req.user.email).toBe('auth-test@test.com');
        });

        it('should continue without user if no token', async () => {
            const req = mockReq();
            req.header.mockReturnValue(undefined);
            const next = jest.fn();

            await optionalAuth(req, {}, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeUndefined();
        });

        it('should continue without user for invalid token', async () => {
            const req = mockReq();
            req.header.mockReturnValue('Bearer bad.token');
            const next = jest.fn();

            await optionalAuth(req, {}, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeUndefined();
        });
    });

    describe('authorizeOwnerOrAdmin()', () => {
        it('should allow admin access', () => {
            const req = {
                user: { role: 'admin', id: 'admin-id' },
                resource: { userId: 'some-other-id' },
            };
            const next = jest.fn();

            authorizeOwnerOrAdmin()(req, {}, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('should allow HR access', () => {
            const req = {
                user: { role: 'hr', id: 'hr-id' },
                resource: { userId: 'some-other-id' },
            };
            const next = jest.fn();

            authorizeOwnerOrAdmin()(req, {}, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('should allow resource owner access', () => {
            const userId = 'owner-id';
            const req = {
                user: { role: 'employee', id: userId },
                resource: { userId: userId },
            };
            const next = jest.fn();

            authorizeOwnerOrAdmin()(req, {}, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('should deny non-owner employee', () => {
            const req = {
                user: { role: 'employee', id: 'employee-id' },
                resource: { userId: 'owner-id' },
            };
            const next = jest.fn();

            authorizeOwnerOrAdmin()(req, {}, next);

            expect(next).toHaveBeenCalled();
            const err = next.mock.calls[0][0];
            expect(err.statusCode).toBe(403);
        });

        it('should deny when no user is attached', () => {
            const req = {};
            const next = jest.fn();

            authorizeOwnerOrAdmin()(req, {}, next);

            expect(next).toHaveBeenCalled();
            const err = next.mock.calls[0][0];
            expect(err.statusCode).toBe(401);
        });
    });
});
