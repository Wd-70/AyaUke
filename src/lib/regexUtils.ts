/**
 * Escapes special regex characters in a string to prevent regex injection attacks.
 *
 * This utility protects against:
 * - ReDoS (Regex Denial of Service) attacks with patterns like (a+)+$
 * - Unintended matching with special characters like .* or ^$
 * - NoSQL injection attempts through regex operators
 *
 * Reference: BUG-011 in BUGS_FOUND.md (lines 262-321)
 * Security: Escapes all 14 special regex characters: . * + ? ^ $ { } ( ) | [ ] \
 *
 * @security Critical security function - do not modify without security review
 * @see BUG-011 in BUGS_FOUND.md for vulnerability details
 *
 * @param input - User-provided search string
 * @returns Sanitized string safe for use in MongoDB $regex queries
 *
 * @example
 * ```typescript
 * escapeRegex('.*') // Returns: '\\.\\*'
 * escapeRegex('user@example.com') // Returns: 'user@example\\.com'
 * escapeRegex('test(123)') // Returns: 'test\\(123\\)'
 * ```
 */
export function escapeRegex(input: string): string {
  // Escape all special regex characters: . * + ? ^ $ { } ( ) | [ ] \
  // Pattern breakdown:
  // - [.*+?^${}()|[\]\\] = Character class matching any special regex char
  // - /g = Global flag to replace all occurrences
  // - '\\$&' = Replacement with escaped version (\\$ prepends backslash)
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates that a string is safe after regex escaping.
 * Used primarily for testing and verification.
 *
 * @param original - Original user input
 * @param escaped - Result from escapeRegex()
 * @returns true if escaping was successful
 */
export function isRegexSafe(original: string, escaped: string): boolean {
  // Check that special characters are properly escaped
  const specialChars = /[.*+?^${}()|[\]\\]/;

  // If original had special chars, escaped version should have backslashes
  if (specialChars.test(original)) {
    return escaped.includes('\\');
  }

  // If no special chars, should be identical
  return original === escaped;
}

// FUTURE CONSIDERATION: MongoDB Text Search Index
// For production workloads with large datasets, consider migrating to:
//
// ChzzkVideoSchema.index({ videoTitle: 'text' });
//
// Then query with:
// const query = search ? { $text: { $search: search } } : {};
//
// Benefits:
// - Native MongoDB tokenization (no escaping needed)
// - Better performance for full-text search
// - Language-aware stemming and stop words
// - Relevance scoring with $meta: "textScore"
//
// Trade-offs:
// - Requires index rebuild (one-time cost)
// - Different search semantics (word boundaries vs substring)
// - Additional storage for text index
