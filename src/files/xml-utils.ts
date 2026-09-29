/**
 * Zero-dependency universal XML helper routines.
 * Works seamlessly in both Node.js (SSR / CLI / Vitest) and modern browser runtimes.
 */

/**
 * Unescape basic XML entities and strip CDATA wrappers.
 */
export function unescapeXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

/**
 * Escape text for safe XML insertion.
 */
export function escapeXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Extract the inner text of the first matching tag, ignoring XML namespace prefixes.
 * E.g., looking for "hr" matches both "<hr>150</hr>" and "<gpxtpx:hr>150</gpxtpx:hr>".
 */
export function getXmlChildTagValue(xmlBlock: string, localName: string): string | null {
  // Regex to match <localName> or <prefix:localName> with optional attributes
  const regex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${localName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${localName}>`, 'i');
  const match = xmlBlock.match(regex);
  if (match && match[1] !== undefined) {
    return unescapeXml(match[1]);
  }
  return null;
}

/**
 * Extract attribute value from an opening XML tag string.
 * E.g., extractAttribute('<trkpt lat="40.123" lon="-74.456">', 'lat') -> '40.123'
 */
export function extractAttribute(tagString: string, attrName: string): string | null {
  const regex = new RegExp(`${attrName}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  const match = tagString.match(regex);
  return match ? match[2] : null;
}

/**
 * Safely format a Date to ISO 8601 string, with validity guard and fallback.
 * Prevents RangeError on invalid Dates like new Date(NaN).
 */
export function safeIsoTimestamp(date?: Date | null, fallback?: Date): string {
  if (date instanceof Date && !isNaN(date.getTime())) {
    return date.toISOString();
  }
  if (fallback instanceof Date && !isNaN(fallback.getTime())) {
    return fallback.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Iterate over all occurrences of a specific tag (both paired `<tag>...</tag>` and self-closing `<tag/>`),
 * returning the opening/self-closing tag and inner content (empty string if self-closing).
 * Handles self-closing elements independently so they never swallow paired tags or corrupt subsequent coordinates.
 */
export function extractAllTags(
  xml: string,
  tagName: string
): Array<{ openTag: string; innerXml: string }> {
  const results: Array<{ openTag: string; innerXml: string }> = [];
  const openRegex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tagName}(?:\\s+[^>]*?)?(\\/?)>`, 'gi');
  const closeRegex = new RegExp(`<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`, 'gi');

  let openMatch: RegExpExecArray | null;
  while ((openMatch = openRegex.exec(xml)) !== null) {
    const openTag = openMatch[0];
    const isSelfClosing = openMatch[1] === '/' || openTag.endsWith('/>');

    if (isSelfClosing) {
      results.push({
        openTag,
        innerXml: '',
      });
    } else {
      const startIndex = openRegex.lastIndex;
      closeRegex.lastIndex = startIndex;
      const closeMatch = closeRegex.exec(xml);
      if (closeMatch) {
        const innerXml = xml.slice(startIndex, closeMatch.index);
        results.push({
          openTag,
          innerXml,
        });
        openRegex.lastIndex = closeRegex.lastIndex;
      }
    }
  }
  return results;
}

