const { success, created, paginated, error, noContent } = require('../../utils/response');

// Helper: create a mock Express response object
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
}

describe('Response Helpers', () => {
    describe('success()', () => {
        it('should return 200 with data and message', () => {
            const res = mockRes();
            success(res, { id: 1 }, 'OK');

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'OK',
                data: { id: 1 },
            });
        });

        it('should use default message "Success"', () => {
            const res = mockRes();
            success(res, { id: 1 });

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Success',
                data: { id: 1 },
            });
        });

        it('should omit data field when data is null', () => {
            const res = mockRes();
            success(res, null, 'Done');

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Done',
            });
        });

        it('should accept custom status code', () => {
            const res = mockRes();
            success(res, null, 'Success', 202);
            expect(res.status).toHaveBeenCalledWith(202);
        });
    });

    describe('created()', () => {
        it('should return 201 with data', () => {
            const res = mockRes();
            created(res, { id: 1 });

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Resource created successfully',
                data: { id: 1 },
            });
        });

        it('should accept custom message', () => {
            const res = mockRes();
            created(res, { id: 1 }, 'User created');

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'User created',
                data: { id: 1 },
            });
        });
    });

    describe('paginated()', () => {
        it('should return items with pagination metadata', () => {
            const res = mockRes();
            const items = [{ id: 1 }, { id: 2 }];
            const pagination = { total: 50, page: 1, limit: 10 };

            paginated(res, items, pagination);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Success',
                data: items,
                pagination: {
                    total: 50,
                    page: 1,
                    limit: 10,
                    pages: 5,
                    hasMore: true,
                },
            });
        });

        it('should set hasMore to false on last page', () => {
            const res = mockRes();
            paginated(res, [], { total: 10, page: 2, limit: 5 });

            const call = res.json.mock.calls[0][0];
            expect(call.pagination.hasMore).toBe(false);
            expect(call.pagination.pages).toBe(2);
        });

        it('should handle single page', () => {
            const res = mockRes();
            paginated(res, [{ id: 1 }], { total: 1, page: 1, limit: 10 });

            const call = res.json.mock.calls[0][0];
            expect(call.pagination.pages).toBe(1);
            expect(call.pagination.hasMore).toBe(false);
        });
    });

    describe('error()', () => {
        it('should return error response with 500 default', () => {
            const res = mockRes();
            error(res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Error',
            });
        });

        it('should include code and errors when provided', () => {
            const res = mockRes();
            const validationErrors = [{ field: 'email', message: 'required' }];
            error(res, 'Validation failed', 400, 'VALIDATION_ERROR', validationErrors);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validationErrors,
            });
        });
    });

    describe('noContent()', () => {
        it('should return 204 with no body', () => {
            const res = mockRes();
            noContent(res);

            expect(res.status).toHaveBeenCalledWith(204);
            expect(res.send).toHaveBeenCalledWith();
        });
    });
});
