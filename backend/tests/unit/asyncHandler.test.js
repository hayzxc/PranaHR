const { asyncHandler, tryCatch } = require('../../utils/asyncHandler');

describe('asyncHandler', () => {
    it('should call the handler function', async () => {
        const handler = jest.fn().mockResolvedValue('ok');
        const req = {};
        const res = {};
        const next = jest.fn();

        const wrapped = asyncHandler(handler);
        await wrapped(req, res, next);

        expect(handler).toHaveBeenCalledWith(req, res, next);
    });

    it('should call next with error on rejected promise', async () => {
        const error = new Error('Something went wrong');
        const handler = jest.fn().mockRejectedValue(error);
        const req = {};
        const res = {};
        const next = jest.fn();

        const wrapped = asyncHandler(handler);
        await wrapped(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
    });

    it('should propagate synchronous throws (not caught by Promise.resolve)', () => {
        const error = new Error('Thrown error');
        const handler = jest.fn().mockImplementation(() => {
            throw error;
        });
        const next = jest.fn();

        const wrapped = asyncHandler(handler);

        // asyncHandler uses Promise.resolve(fn(...)) — the fn() call
        // throws synchronously BEFORE Promise.resolve can wrap it
        expect(() => wrapped({}, {}, next)).toThrow('Thrown error');
    });

    it('should not call next when handler succeeds', async () => {
        const handler = jest.fn().mockResolvedValue('ok');
        const next = jest.fn();

        const wrapped = asyncHandler(handler);
        await wrapped({}, {}, next);

        // next should not be called with an error
        expect(next).not.toHaveBeenCalled();
    });
});

describe('tryCatch', () => {
    it('should call the handler function', async () => {
        const handler = jest.fn().mockResolvedValue('ok');
        const req = {};
        const res = {};
        const next = jest.fn();

        const wrapped = tryCatch(handler);
        await wrapped(req, res, next);

        expect(handler).toHaveBeenCalledWith(req, res, next);
    });

    it('should call next with error on rejected promise', async () => {
        const error = new Error('Async error');
        const handler = jest.fn().mockRejectedValue(error);
        const next = jest.fn();

        const wrapped = tryCatch(handler);
        await wrapped({}, {}, next);

        expect(next).toHaveBeenCalledWith(error);
    });

    it('should call next with error on thrown exception', async () => {
        const error = new Error('Thrown');
        const handler = jest.fn().mockImplementation(() => {
            throw error;
        });
        const next = jest.fn();

        const wrapped = tryCatch(handler);
        await wrapped({}, {}, next);

        expect(next).toHaveBeenCalledWith(error);
    });
});
