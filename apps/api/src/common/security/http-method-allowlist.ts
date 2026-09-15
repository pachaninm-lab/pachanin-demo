// ASVS V4.1.4. Route binding already means that an undeclared method on a
// declared path does not reach a handler, and that was credited - but it is not
// an allowlist. It says nothing about paths no route claims, nothing about what
// preflight advertises, and nothing about methods the framework or a proxy in
// front of it might answer on its own. TRACE is the standard example: nothing
// here declares it, and a server that answers it reflects the request back
// including headers the page's own script cannot read.
//
// So the set is stated once, here, and everything outside it is refused before
// any routing, body parsing or metrics happen.

// Every method any controller in this API declares, plus the two the protocol
// requires alongside them: HEAD, which the framework answers from the GET
// route, and OPTIONS, which carries CORS preflight.
export const SUPPORTED_HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

export type SupportedHttpMethod = (typeof SUPPORTED_HTTP_METHODS)[number];

// RFC 9110: a 405 response must say what is allowed, and this is also the list
// handed to CORS so that preflight advertises the same set it will honour.
export const ALLOW_HEADER_VALUE = SUPPORTED_HTTP_METHODS.join(', ');

const SUPPORTED = new Set<string>(SUPPORTED_HTTP_METHODS);

/**
 * Method names are case-sensitive: `get` is not `GET`, and treating them as the
 * same is how a filter in front of an application gets walked past. The
 * comparison is exact for that reason.
 */
export function isSupportedHttpMethod(method: unknown): method is SupportedHttpMethod {
  return typeof method === 'string' && SUPPORTED.has(method);
}

interface MethodRequest {
  method?: string;
}

interface MethodResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(): void;
}

/**
 * Refuses anything outside the declared set with 405 and an Allow header, and
 * sends no body: a refusal should not describe the application to whoever is
 * probing it.
 */
export function httpMethodAllowlist(
  request: MethodRequest,
  response: MethodResponse,
  next: () => void,
): void {
  if (isSupportedHttpMethod(request.method)) {
    next();
    return;
  }
  response.statusCode = 405;
  response.setHeader('Allow', ALLOW_HEADER_VALUE);
  response.setHeader('Content-Length', '0');
  response.end();
}
