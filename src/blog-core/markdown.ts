// Markdown settings that reproduce the legacy python-markdown output
// (extensions: extra, smarty, toc, tables, footnotes) closely enough that
// visible text, heading anchors and code blocks stay identical.

// python-markdown `smarty`: `--` is an en dash, `---` an em dash, `...` an
// ellipsis, straight quotes curl, backtick quotes are left alone.
export const smartypantsOptions = {
  backticks: false,
  dashes: 'oldschool',
  ellipses: true,
  quotes: true,
} as const;

// python-markdown `toc` slugify (markdown 3.x): NFKD, drop non-ASCII, drop
// anything that is not a word character, whitespace or hyphen, strip, lower,
// then collapse runs of hyphens/whitespace into a single hyphen.
export function legacySlugify(value: string): string {
  const ascii = value.normalize('NFKD').replace(/[^\x00-\x7f]/g, '');
  return ascii
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '-');
}

// python-markdown `toc` unique(): append _1, _2 ... (or bump an existing
// trailing _N) until the id is unused and non-empty.
export function legacyUniqueId(id: string, used: Set<string>): string {
  let candidate = id;
  while (used.has(candidate) || !candidate) {
    const match = /^(.*)_([0-9]+)$/.exec(candidate);
    candidate = match ? `${match[1]}_${Number(match[2]) + 1}` : `${candidate}_1`;
  }
  used.add(candidate);
  return candidate;
}

// --- Raw HTML blocks -------------------------------------------------------
//
// python-markdown keeps a raw HTML block that starts with a block-level tag
// at the start of a line as one opaque block until its matching close tag,
// blank lines included. CommonMark ends such a block at the first blank line,
// so an inline <svg> with blank lines inside a <figure> would fall apart into
// paragraphs and indented code, and a block tag CommonMark does not know
// (<video>, <canvas>, <math> ...) would be wrapped in a <p>. Before remark
// parses a post, every such block is swapped for a placeholder comment; after
// remark-rehype the placeholder is swapped back for the original HTML.

// python-markdown 3.x Markdown(extensions=["extra"]).block_level_elements
const LEGACY_BLOCK_LEVEL = new Set([
  'address', 'article', 'aside', 'blockquote', 'body', 'canvas', 'center', 'colgroup', 'dd',
  'details', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'group',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'html', 'iframe', 'legend', 'li',
  'main', 'map', 'math', 'menu', 'nav', 'noscript', 'object', 'ol', 'option', 'output', 'p', 'pre',
  'progress', 'script', 'section', 'style', 'summary', 'table', 'tbody', 'td', 'textarea', 'tfoot',
  'th', 'thead', 'tr', 'ul', 'video',
]);
const HTML_VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
]);
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'pre']);
const BLOCK_START = /^ {0,3}<([a-zA-Z][a-zA-Z0-9-]*)(?=[\s/>]|$)/;
const LONE_OPEN_TAG = /^ {0,3}<[a-zA-Z][a-zA-Z0-9-]*(?:\s+[^\s"'=<>`/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>\s*$/;
const FENCE =/^ {0,3}(`{3,}|~{3,})/;
const PLACEHOLDER_PREFIX = 'legacy-raw-html:';

/** End offset (exclusive) of the element opened at `start`, or -1 if unclosed. */
function matchingCloseEnd(source: string, start: number): number {
  const stack: string[] = [];
  const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/g;
  token.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = token.exec(source))) {
    if (match[0].startsWith('<!--')) continue;
    const closing = match[1] === '/';
    const tag = match[2].toLowerCase();
    if (!closing) {
      if (HTML_VOID.has(tag) || match[0].endsWith('/>')) {
        if (stack.length === 0) return token.lastIndex;
        continue;
      }
      stack.push(tag);
      if (RAW_TEXT.has(tag)) {
        // Content of script/style/textarea/pre is not scanned for tags.
        const close = new RegExp(`</${tag}\\s*>`, 'gi');
        close.lastIndex = token.lastIndex;
        const end = close.exec(source);
        if (!end) return -1;
        stack.pop();
        token.lastIndex = close.lastIndex;
        if (stack.length === 0) return token.lastIndex;
      }
      continue;
    }
    if (!stack.includes(tag)) continue;
    while (stack.length && stack.pop() !== tag);
    if (stack.length === 0) return token.lastIndex;
  }
  return -1;
}

const QUOTE_LINE = /^ {0,3}>/;

/**
 * python-markdown folds a `>` block that follows a blank line into the
 * blockquote just before it; CommonMark starts a new blockquote. Turn the
 * separating blank lines into bare `>` lines so both read one blockquote.
 */
export function mergeLegacyBlockquotes(markdown: string): string {
  const lines = markdown.split('\n');
  let fence: string | null = null;
  const inFence = lines.map((line) => {
    const match = FENCE.exec(line);
    if (fence) {
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length) fence = null;
      return true;
    }
    if (match) {
      fence = match[1];
      return true;
    }
    return false;
  });
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() !== '' || inFence[index]) continue;
    const previous = index - 1;
    if (inFence[previous] || !QUOTE_LINE.test(lines[previous])) continue;
    let following = index;
    while (following < lines.length && lines[following].trim() === '') following += 1;
    if (following < lines.length && !inFence[following] && QUOTE_LINE.test(lines[following])) {
      for (let blank = index; blank < following; blank += 1) lines[blank] = '>';
    }
  }
  return lines.join('\n');
}

/** Replace raw HTML blocks with placeholders; returns the stash. */
export function stashLegacyHtmlBlocks(markdown: string): { markdown: string; stash: string[] } {
  const stash: string[] = [];
  let out = '';
  let position = 0;
  let fence: string | null = null;
  let previousBlank = true;
  while (position < markdown.length) {
    const lineEnd = markdown.indexOf('\n', position);
    const next = lineEnd === -1 ? markdown.length : lineEnd + 1;
    const line = markdown.slice(position, lineEnd === -1 ? markdown.length : lineEnd);
    const fenceMatch = FENCE.exec(line);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
      out += markdown.slice(position, next);
      position = next;
      previousBlank = false;
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      out += markdown.slice(position, next);
      position = next;
      previousBlank = false;
      continue;
    }
    const start = BLOCK_START.exec(line);
    if (start && LEGACY_BLOCK_LEVEL.has(start[1].toLowerCase())) {
      const tagStart = position + line.indexOf('<');
      const openTag = /^<[^>]*>/.exec(markdown.slice(tagStart))?.[0] ?? '';
      const end = matchingCloseEnd(markdown, tagStart);
      if (end !== -1 && !/\smarkdown\s*=/.test(openTag)) {
        const closeLineEnd = markdown.indexOf('\n', end);
        const rest = markdown.slice(end, closeLineEnd === -1 ? markdown.length : closeLineEnd);
        const block = markdown.slice(position, end);
        if (rest.trim() === '') {
          stash.push(block);
          out += `${previousBlank ? '' : '\n'}<!--${PLACEHOLDER_PREFIX}${stash.length - 1}-->\n\n`;
          position = closeLineEnd === -1 ? markdown.length : closeLineEnd + 1;
          previousBlank = true;
          continue;
        }
      }
    }
    // A lone inline tag on its own paragraph (`<img ...>` between blank
    // lines) is a paragraph to python-markdown but a bare HTML block to
    // CommonMark; keep the legacy <p> wrapper.
    const followingLine = markdown.slice(next, markdown.indexOf('\n', next) === -1 ? markdown.length : markdown.indexOf('\n', next));
    if (
      start &&
      previousBlank &&
      followingLine.trim() === '' &&
      !LEGACY_BLOCK_LEVEL.has(start[1].toLowerCase()) &&
      LONE_OPEN_TAG.test(line)
    ) {
      stash.push(`<p>${line.trim()}</p>`);
      out += `<!--${PLACEHOLDER_PREFIX}${stash.length - 1}-->\n`;
      position = next;
      previousBlank = false;
      continue;
    }
    out += markdown.slice(position, next);
    previousBlank = line.trim() === '';
    position = next;
  }
  return { markdown: out, stash };
}

interface ParserProcessor {
  parser?: (document: string, file: { data: Record<string, unknown> }) => unknown;
}

/** Remark plugin: wraps the parser so raw HTML blocks and blockquotes follow the legacy rules. */
export function remarkLegacyHtmlBlocks(this: ParserProcessor) {
  const parse = this.parser;
  if (!parse) throw new Error('remarkLegacyHtmlBlocks must run after remark-parse');
  this.parser = (document, file) => {
    const { markdown, stash } = stashLegacyHtmlBlocks(String(document));
    file.data.legacyRawHtml = stash;
    return parse(mergeLegacyBlockquotes(markdown), file);
  };
}

/** Rehype plugin: puts the stashed raw HTML back in place of its placeholder. */
export function rehypeLegacyHtmlBlocks() {
  return (tree: HastNode, file: { data: Record<string, unknown> }) => {
    const stash = (file.data.legacyRawHtml as string[] | undefined) ?? [];
    if (!stash.length) return;
    const placeholder = new RegExp(`^<!--${PLACEHOLDER_PREFIX}(\\d+)-->$`);
    walk(tree, (node) => {
      if (node.type !== 'raw') return;
      const match = placeholder.exec((node.value ?? '').trim());
      if (match) node.value = stash[Number(match[1])].replace(/\n+$/, '');
    });
  };
}

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

function walk(node: HastNode, visit: (node: HastNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function textContent(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textContent).join('');
}

const HEADING = /^h[1-6]$/;

// Runs before Astro's own heading-id plugin, which keeps any id already set,
// so markdown headings get the same anchors the legacy build emitted.
export function rehypeLegacyHeadingIds() {
  return (tree: HastNode) => {
    const used = new Set<string>();
    walk(tree, (node) => {
      const id = node.properties?.id;
      if (node.type === 'element' && typeof id === 'string') used.add(id);
    });
    walk(tree, (node) => {
      if (node.type !== 'element' || !HEADING.test(node.tagName ?? '')) return;
      node.properties ??= {};
      if (typeof node.properties.id === 'string') return;
      node.properties.id = legacyUniqueId(legacySlugify(textContent(node)), used);
    });
  };
}

// python-markdown `tables` writes column alignment as an inline style;
// remark-gfm uses the obsolete align attribute. Emit the legacy form.
export function rehypeLegacyTableAlign() {
  return (tree: HastNode) => {
    walk(tree, (node) => {
      if (node.type !== 'element' || (node.tagName !== 'th' && node.tagName !== 'td')) return;
      const align = node.properties?.align;
      if (typeof align !== 'string' || !align) return;
      delete node.properties!.align;
      node.properties!.style = `text-align: ${align};`;
    });
  };
}
