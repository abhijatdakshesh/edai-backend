import { HttpException, HttpStatus, NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { ArgumentsHost } from '@nestjs/common';

/** Build a fake ArgumentsHost that captures the response JSON. */
function buildHost(url = '/test-path'): {
  host: ArgumentsHost;
  jsonSpy: jest.Mock;
  statusSpy: jest.Mock;
} {
  const jsonSpy = jest.fn();
  const statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });

  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status: statusSpy }),
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost;

  return { host, jsonSpy, statusSpy };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  // ─── HttpException types ─────────────────────────────────────────────────────

  it('formats NotFoundException (404) correctly', () => {
    const { host, statusSpy, jsonSpy } = buildHost('/students/99');
    filter.catch(new NotFoundException('Student not found'), host);

    expect(statusSpy).toHaveBeenCalledWith(404);
    const body = jsonSpy.mock.calls[0][0];
    expect(body.code).toBe('NOT_FOUND');
    expect(body.message).toContain('not found');
    expect(body.path).toBe('/students/99');
    expect(body.timestamp).toBeDefined();
    expect(body.details).toBeNull();
  });

  it('formats BadRequestException (400) correctly', () => {
    const { host, statusSpy, jsonSpy } = buildHost('/auth/login');
    filter.catch(new BadRequestException('Validation failed'), host);
    expect(statusSpy).toHaveBeenCalledWith(400);
    const body = jsonSpy.mock.calls[0][0];
    expect(body.code).toBe('BAD_REQUEST');
  });

  it('formats UnauthorizedException (401) correctly', () => {
    const { host, statusSpy, jsonSpy } = buildHost();
    filter.catch(new UnauthorizedException('Token invalid'), host);
    expect(statusSpy).toHaveBeenCalledWith(401);
    expect(jsonSpy.mock.calls[0][0].code).toBe('UNAUTHORIZED');
  });

  it('formats ForbiddenException (403) correctly', () => {
    const { host, statusSpy, jsonSpy } = buildHost();
    filter.catch(new ForbiddenException('Access denied'), host);
    expect(statusSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy.mock.calls[0][0].code).toBe('FORBIDDEN');
  });

  it('formats generic 500 non-HttpException correctly', () => {
    const { host, statusSpy, jsonSpy } = buildHost('/internal');
    filter.catch(new Error('DB connection lost'), host);
    expect(statusSpy).toHaveBeenCalledWith(500);
    const body = jsonSpy.mock.calls[0][0];
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('Internal server error');
  });

  it('handles HttpException with string response', () => {
    const { host, jsonSpy } = buildHost();
    filter.catch(new HttpException('plain string error', HttpStatus.CONFLICT), host);
    const body = jsonSpy.mock.calls[0][0];
    expect(body.code).toBe('CONFLICT');
    expect(body.message).toBe('plain string error');
  });

  it('uses custom code from exception response when present', () => {
    const { host, jsonSpy } = buildHost();
    const exception = new HttpException(
      { message: 'Custom error', code: 'CUSTOM_CODE' },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
    filter.catch(exception, host);
    const body = jsonSpy.mock.calls[0][0];
    expect(body.code).toBe('CUSTOM_CODE');
    expect(body.message).toBe('Custom error');
  });

  it('falls back to statusToCode when no code in response', () => {
    const { host, jsonSpy } = buildHost();
    const exception = new HttpException({ message: 'Something went wrong' }, HttpStatus.UNPROCESSABLE_ENTITY);
    filter.catch(exception, host);
    expect(jsonSpy.mock.calls[0][0].code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('includes request url in path field', () => {
    const { host, jsonSpy } = buildHost('/api/fees/student/USN001');
    filter.catch(new NotFoundException(), host);
    expect(jsonSpy.mock.calls[0][0].path).toBe('/api/fees/student/USN001');
  });

  it('timestamp is a valid ISO string', () => {
    const { host, jsonSpy } = buildHost();
    filter.catch(new Error('any'), host);
    const ts = jsonSpy.mock.calls[0][0].timestamp;
    expect(() => new Date(ts)).not.toThrow();
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  it('falls back to INTERNAL_ERROR for unknown HTTP status codes', () => {
    const { host, jsonSpy } = buildHost();
    const exception = new HttpException({ message: 'Weird status' }, 418); // I'm a teapot
    filter.catch(exception, host);
    expect(jsonSpy.mock.calls[0][0].code).toBe('INTERNAL_ERROR');
  });
});
