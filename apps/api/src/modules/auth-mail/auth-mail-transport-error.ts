export class AuthMailTransportError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'AuthMailTransportError';
  }
}
