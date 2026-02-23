const { errorHandler, notFoundHandler } = require('../../middleware/errorHandler');
const { AppError, ValidationError } = require('../../utils/errors');

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('Error Handler Middleware', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
    });

    describe('Development mode', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        it('should send full error details in dev mode', () => {
            const res = mockRes();
            const err = new AppError('Dev error', 400, 'TEST_ERROR');

            errorHandler(err, {}, res, jest.fn());

            expect(res.status).toHaveBeenCalledWith(400);
            const body = res.json.mock.calls[0][0];
            expect(body.success).toBe(false);
            expect(body.message).toBe('Dev error');
            expect(body.code).toBe('TEST_ERROR');
            expect(body.stack).toBeDefined();
        });
    });

    describe('Production mode', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        it('should send operational error details in prod mode', () => {
            const res = mockRes();
            const err = new AppError('Not found', 404, 'NOT_FOUND');

            errorHandler(err, {}, res, jest.fn());

            expect(res.status).toHaveBeenCalledWith(404);
            const body = res.json.mock.calls[0][0];
            expect(body.success).toBe(false);
            expect(body.message).toBe('Not found');
            expect(body.stack).toBeUndefined();
        });

        it('should hide non-operational error details in prod mode', () => {
            const res = mockRes();
            const err = new Error('Unexpected crash');
            err.statusCode = 500;
            err.status = 'error';

            // Suppress console.error during this test
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            errorHandler(err, {}, res, jest.fn());
            consoleSpy.mockRestore();

            expect(res.status).toHaveBeenCalledWith(500);
            const body = res.json.mock.calls[0][0];
            expect(body.message).toBe('Something went wrong');
        });

        it('should handle Mongoose CastError', () => {
            const res = mockRes();
            const err = new Error('Cast error');
            err.name = 'CastError';
            err.path = '_id';
            err.value = 'invalid-id';

            errorHandler(err, {}, res, jest.fn());

            expect(res.status).toHaveBeenCalledWith(400);
            const body = res.json.mock.calls[0][0];
            expect(body.message).toContain('Invalid');
        });

        it('should handle Mongoose duplicate key error', () => {
            const res = mockRes();
            const err = new Error('Duplicate');
            err.code = 11000;
            err.keyValue = { email: 'test@test.com' };

            errorHandler(err, {}, res, jest.fn());

            expect(res.status).toHaveBeenCalledWith(409);
            const body = res.json.mock.calls[0][0];
            expect(body.message).toContain('Duplicate field value');
        });

        it('should handle Mongoose ValidationError', () => {
            const res = mockRes();
            const err = new Error('Validation');
            err.name = 'ValidationError';
            err.errors = {
                email: { path: 'email', message: 'Email required', value: '' },
            };

            errorHandler(err, {}, res, jest.fn());

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle JsonWebTokenError', () => {
            const res = mockRes();
            const err = new Error('jwt malformed');
            err.name = 'JsonWebTokenError';

            errorHandler(err, {}, res, jest.fn());

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should handle TokenExpiredError', () => {
            const res = mockRes();
            const err = new Error('jwt expired');
            err.name = 'TokenExpiredError';

            errorHandler(err, {}, res, jest.fn());

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should handle MulterError for file size', () => {
            const res = mockRes();
            const err = new Error('File too large');
            err.name = 'MulterError';
            err.code = 'LIMIT_FILE_SIZE';

            errorHandler(err, {}, res, jest.fn());

            expect(res.status).toHaveBeenCalledWith(400);
            const body = res.json.mock.calls[0][0];
            expect(body.message).toContain('File too large');
        });
    });

    describe('Default status code', () => {
        it('should default to 500 when no statusCode is set', () => {
            process.env.NODE_ENV = 'development';
            const res = mockRes();
            const err = new Error('Generic error');

            errorHandler(err, {}, res, jest.fn());

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});

describe('notFoundHandler', () => {
    it('should create 404 error and pass to next', () => {
        const req = { method: 'GET', originalUrl: '/api/nonexistent' };
        const res = {};
        const next = jest.fn();

        notFoundHandler(req, res, next);

        expect(next).toHaveBeenCalled();
        const err = next.mock.calls[0][0];
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe('ROUTE_NOT_FOUND');
        expect(err.message).toContain('GET');
        expect(err.message).toContain('/api/nonexistent');
    });
});
