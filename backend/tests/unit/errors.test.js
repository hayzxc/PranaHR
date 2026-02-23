const {
    AppError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
    BadRequestError,
    InternalError,
    RateLimitError,
} = require('../../utils/errors');

describe('Custom Error Classes', () => {
    describe('AppError', () => {
        it('should create error with message and status code', () => {
            const error = new AppError('Test error', 400);
            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(400);
            expect(error.status).toBe('fail');
            expect(error.isOperational).toBe(true);
            expect(error).toBeInstanceOf(Error);
        });

        it('should set status to "error" for 5xx codes', () => {
            const error = new AppError('Server error', 500);
            expect(error.status).toBe('error');
        });

        it('should set status to "fail" for 4xx codes', () => {
            const error = new AppError('Client error', 404);
            expect(error.status).toBe('fail');
        });

        it('should include custom error code', () => {
            const error = new AppError('Test', 400, 'CUSTOM_CODE');
            expect(error.code).toBe('CUSTOM_CODE');
        });

        it('should have a stack trace', () => {
            const error = new AppError('Test', 400);
            expect(error.stack).toBeDefined();
        });
    });

    describe('ValidationError', () => {
        it('should create with 400 status and VALIDATION_ERROR code', () => {
            const error = new ValidationError('Invalid input');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.isOperational).toBe(true);
        });

        it('should include validation errors array', () => {
            const errors = [{ field: 'email', message: 'Invalid email' }];
            const error = new ValidationError('Validation failed', errors);
            expect(error.errors).toEqual(errors);
        });

        it('should default to empty errors array', () => {
            const error = new ValidationError('Validation failed');
            expect(error.errors).toEqual([]);
        });
    });

    describe('NotFoundError', () => {
        it('should create with 404 status and resource name', () => {
            const error = new NotFoundError('Employee');
            expect(error.statusCode).toBe(404);
            expect(error.message).toBe('Employee not found');
            expect(error.code).toBe('NOT_FOUND');
            expect(error.resource).toBe('Employee');
        });

        it('should default to "Resource"', () => {
            const error = new NotFoundError();
            expect(error.message).toBe('Resource not found');
        });
    });

    describe('UnauthorizedError', () => {
        it('should create with 401 status', () => {
            const error = new UnauthorizedError();
            expect(error.statusCode).toBe(401);
            expect(error.code).toBe('UNAUTHORIZED');
            expect(error.message).toBe('Unauthorized access');
        });

        it('should accept custom message', () => {
            const error = new UnauthorizedError('Token expired');
            expect(error.message).toBe('Token expired');
        });
    });

    describe('ForbiddenError', () => {
        it('should create with 403 status', () => {
            const error = new ForbiddenError();
            expect(error.statusCode).toBe(403);
            expect(error.code).toBe('FORBIDDEN');
        });
    });

    describe('ConflictError', () => {
        it('should create with 409 status', () => {
            const error = new ConflictError();
            expect(error.statusCode).toBe(409);
            expect(error.code).toBe('CONFLICT');
        });
    });

    describe('BadRequestError', () => {
        it('should create with 400 status', () => {
            const error = new BadRequestError();
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('BAD_REQUEST');
        });
    });

    describe('InternalError', () => {
        it('should create with 500 status and isOperational false', () => {
            const error = new InternalError();
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('INTERNAL_ERROR');
            expect(error.isOperational).toBe(false);
        });
    });

    describe('RateLimitError', () => {
        it('should create with 429 status', () => {
            const error = new RateLimitError();
            expect(error.statusCode).toBe(429);
            expect(error.code).toBe('RATE_LIMIT');
        });
    });

    describe('Inheritance', () => {
        it('all errors should be instances of AppError', () => {
            expect(new ValidationError('test')).toBeInstanceOf(AppError);
            expect(new NotFoundError()).toBeInstanceOf(AppError);
            expect(new UnauthorizedError()).toBeInstanceOf(AppError);
            expect(new ForbiddenError()).toBeInstanceOf(AppError);
            expect(new ConflictError()).toBeInstanceOf(AppError);
            expect(new BadRequestError()).toBeInstanceOf(AppError);
            expect(new InternalError()).toBeInstanceOf(AppError);
            expect(new RateLimitError()).toBeInstanceOf(AppError);
        });

        it('all errors should be instances of Error', () => {
            expect(new ValidationError('test')).toBeInstanceOf(Error);
            expect(new NotFoundError()).toBeInstanceOf(Error);
            expect(new UnauthorizedError()).toBeInstanceOf(Error);
        });
    });
});
