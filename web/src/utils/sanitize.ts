/**
 * Sanitization utilities for user-supplied content.
 *
 * These functions **escape** HTML entities so that untrusted text is safe to
 * insert into the DOM via `innerHTML` or template rendering.  They do *not*
 * remove content -- they neutralise it so that the browser renders it as
 * plain text rather than active markup.
 *
 * IMPORTANT
 * ---------
 * - These are **output**-side defences.  Input validation should happen
 *   server-side (e.g. with Zod schemas).
 * - Always sanitise *before* inserting user-controlled strings into the DOM.
 * - For React projects use `{escapedValue}` (React escapes by default).
 *   This utility is intended for raw HTML interpolation or web-component
 *   based rendering.
 */

// ---------------------------------------------------------------------------
// HTML entity mapping
// ---------------------------------------------------------------------------

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
};

/** Regex matching all characters that need escaping. */
const UNSAFE_CHARS_RE = /[&<>"'/]/g;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Escape HTML-special characters in a string so it can be safely inserted
 * into the DOM as text content.
 *
 * @example
 * ```ts
 * sanitizeHtml('<script>alert("xss")</script>')
 * // => "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;"
 * ```
 */
export function sanitizeHtml(input: string): string {
  return input.replace(UNSAFE_CHARS_RE, (ch) => HTML_ENTITIES[ch] || ch);
}

/**
 * Strip HTML tags from a string entirely, returning only the text content.
 * Useful when you want to remove all markup (e.g. for plain-text previews).
 *
 * @example
 * ```ts
 * stripTags('<p>Hello <b>world</b></p>')
 * // => "Hello world"
 * ```
 */
export function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a string for safe use in a URL query parameter value.
 * Encodes special characters via `encodeURIComponent`.
 *
 * @example
 * ```ts
 * sanitizeUrlParam('hello world & more')
 * // => "hello%20world%20%26%20more"
 * ```
 */
export function sanitizeUrlParam(input: string): string {
  return encodeURIComponent(input);
}
