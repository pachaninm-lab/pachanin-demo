/**
 * Building the Content-Disposition value for a user-uploaded file.
 *
 * ASVS 5.0 V3.2.1 asks for a control that stops a browser rendering content in
 * the wrong context when a resource is requested directly, and names the
 * attachment disposition type as one such control. Uploaded files here are
 * fetched straight from object storage through a presigned URL - the bytes
 * never pass through this application - so whether an uploaded .html or .svg
 * renders in the browser was decided entirely by the bucket's own default
 * configuration, which is not in version control and cannot be checked here.
 * Asking the storage to return `attachment` moves that decision into the
 * application, where it can be asserted.
 *
 * The header value is built rather than interpolated. sanitizeFilename runs at
 * upload time and already removes control characters and quotes, but a record
 * written before it existed, or by any other path, has not been through it, and
 * a filename reaching a header is the one place where a stray quote or newline
 * stops being a cosmetic problem.
 */

/**
 * Characters that may appear unescaped in the quoted-string form of a header
 * parameter. Everything else is replaced, because the ASCII form is a fallback
 * for old clients and losing fidelity there costs nothing: the exact name
 * travels in the RFC 5987 form alongside it.
 */
const ASCII_SAFE = /[^\u0020-\u007e]/gu;
const QUOTED_UNSAFE = /["\\]/gu;

/**
 * Percent-encodes for the RFC 5987 ext-value form.
 *
 * encodeURIComponent leaves !'()* unreserved, and RFC 5987's attr-char set does
 * not include ' ( ) or *, so those are encoded explicitly rather than trusted
 * to the built-in.
 */
function rfc5987Encode(value: string): string {
  return encodeURIComponent(value)
    .replace(/['()*]/gu, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Returns a Content-Disposition value that forces a download.
 *
 * Both parameter forms are emitted: `filename` for clients that read only the
 * ASCII form, and `filename*` carrying the exact UTF-8 name, which matters here
 * because filenames on this platform are routinely Cyrillic and the ASCII
 * fallback cannot represent them.
 */
export function attachmentDisposition(filename: unknown): string {
  const raw = typeof filename === 'string' ? filename : '';
  // A path separator in a stored name must not become a directory hint.
  const leaf = raw.split(/[\\/]/u).pop() ?? '';
  // Control characters are removed outright: CR and LF in a header value are a
  // header-splitting primitive, not a naming choice.
  const clean = leaf.replace(/[\u0000-\u001f\u007f]/gu, '').trim();

  if (clean === '') return 'attachment';

  const ascii = clean.replace(ASCII_SAFE, '_').replace(QUOTED_UNSAFE, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${rfc5987Encode(clean)}`;
}
