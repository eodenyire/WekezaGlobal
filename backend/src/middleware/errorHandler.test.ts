import { createError } from '../middleware/errorHandler';

describe('createError', () => {
  it('creates an error with the given message and status code', () => {
    const err = createError('Not found', 404);
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('NotFound');
  });

  it('defaults to status 500 when no code is provided', () => {
    const err = createError('Unexpected failure');
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe('InternalServerError');
  });

  it('maps standard HTTP status codes to readable names', () => {
    const cases: Array<[number, string]> = [
      [400, 'BadRequest'],
      [401, 'Unauthorized'],
      [403, 'Forbidden'],
      [404, 'NotFound'],
      [409, 'Conflict'],
      [422, 'UnprocessableEntity'],
      [429, 'TooManyRequests'],
      [500, 'InternalServerError'],
      [503, 'ServiceUnavailable'],
    ];
    for (const [code, name] of cases) {
      expect(createError('msg', code).name).toBe(name);
    }
  });

  it('returns an instance of Error', () => {
    expect(createError('bad', 400) instanceof Error).toBe(true);
  });
});
