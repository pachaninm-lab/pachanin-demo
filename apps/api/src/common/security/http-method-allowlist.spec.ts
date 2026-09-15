import {
  ALLOW_HEADER_VALUE,
  SUPPORTED_HTTP_METHODS,
  httpMethodAllowlist,
  isSupportedHttpMethod,
} from './http-method-allowlist';

function call(method: unknown) {
  const headers: Record<string, string> = {};
  let ended = false;
  let passed = false;
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string) { headers[name] = value; },
    end() { ended = true; },
  };
  httpMethodAllowlist({ method: method as string }, response, () => { passed = true; });
  return { passed, ended, status: response.statusCode, headers };
}

describe('http method allowlist', () => {
  it('lets through every method a controller in this API declares', () => {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      const result = call(method);
      expect(result.passed).toBe(true);
      expect(result.ended).toBe(false);
    }
  });

  it('lets through the two the protocol requires alongside them', () => {
    // HEAD is answered from the GET route by the framework; OPTIONS carries
    // CORS preflight. Blocking either breaks ordinary clients.
    for (const method of ['HEAD', 'OPTIONS']) {
      expect(call(method).passed).toBe(true);
    }
  });

  it('refuses TRACE, which nothing declares and which reflects the request back', () => {
    const result = call('TRACE');
    expect(result.passed).toBe(false);
    expect(result.status).toBe(405);
    expect(result.ended).toBe(true);
  });

  it('refuses the other methods nothing here declares', () => {
    for (const method of ['TRACK', 'CONNECT', 'PROPFIND', 'MKCOL', 'COPY', 'MOVE', 'LOCK', 'DEBUG']) {
      expect(call(method).status).toBe(405);
    }
  });

  it('refuses a lowercase spelling, because a method name is case-sensitive', () => {
    // `get` is a different method from `GET`. Folding case here is how a
    // filter in front of an application gets walked past.
    for (const method of ['get', 'Get', 'post', 'trace']) {
      expect(call(method).status).toBe(405);
    }
    expect(isSupportedHttpMethod('get')).toBe(false);
    expect(isSupportedHttpMethod('GET')).toBe(true);
  });

  it('refuses a missing or non-string method rather than assuming one', () => {
    for (const method of [undefined, null, '', 42, {}, []]) {
      expect(call(method).status).toBe(405);
    }
  });

  it('says what is allowed, as a 405 must, and returns no body', () => {
    const result = call('TRACE');
    expect(result.headers.Allow).toBe(ALLOW_HEADER_VALUE);
    expect(result.headers.Allow).toBe('GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    expect(result.headers['Content-Length']).toBe('0');
  });

  it('is the same list that preflight is told about', () => {
    // main.ts hands SUPPORTED_HTTP_METHODS to enableCors, so a method added
    // here is advertised, and one removed here stops being advertised. The
    // two cannot drift apart.
    expect([...SUPPORTED_HTTP_METHODS]).toEqual(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
    expect(ALLOW_HEADER_VALUE.split(', ')).toEqual([...SUPPORTED_HTTP_METHODS]);
  });
});
