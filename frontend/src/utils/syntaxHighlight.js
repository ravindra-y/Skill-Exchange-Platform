import Prism from 'prismjs';

// Base dependencies and languages
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-tsx.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-java.js';
import 'prismjs/components/prism-c.js';
import 'prismjs/components/prism-cpp.js';
import 'prismjs/components/prism-csharp.js';
import 'prismjs/components/prism-go.js';
import 'prismjs/components/prism-rust.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-markdown.js';
import 'prismjs/components/prism-docker.js';
import 'prismjs/components/prism-graphql.js';
import 'prismjs/components/prism-scss.js';
import 'prismjs/components/prism-markup-templating.js';
import 'prismjs/components/prism-php.js';
import 'prismjs/components/prism-ruby.js';
import 'prismjs/components/prism-kotlin.js';
import 'prismjs/components/prism-swift.js';

// Common control flow keywords across languages to visually distinguish from declaration keywords
const CONTROL_FLOW_KEYWORDS = new Set([
  'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
  'continue', 'try', 'catch', 'finally', 'throw', 'import', 'export', 'from',
  'as', 'default', 'await', 'async', 'yield', 'pass', 'raise', 'except',
  'with', 'elif', 'match', 'goto'
]);

// Well-known built-in functions
const BUILTIN_FUNCTIONS = new Set([
  'require', 'fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI',
  'encodeURIComponent', 'decodeURIComponent', 'alert', 'prompt', 'confirm',
  'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'input'
]);

// Register hook once to tag control-flow keywords and built-in functions
let hookRegistered = false;
if (!hookRegistered && Prism.hooks) {
  Prism.hooks.add('wrap', (env) => {
    if (env.type === 'keyword' && CONTROL_FLOW_KEYWORDS.has(env.content)) {
      env.classes.push('control-flow');
    } else if (env.type === 'function' && BUILTIN_FUNCTIONS.has(env.content)) {
      env.classes.push('builtin');
    }
  });
  hookRegistered = true;
}

// Language normalization aliases
const LANGUAGE_ALIASES = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  python: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  bash: 'bash',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  markup: 'markup',
  css: 'css',
  scss: 'scss',
  json: 'json',
  sql: 'sql',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  csharp: 'csharp',
  cs: 'csharp',
  'c#': 'csharp',
  dotnet: 'csharp',
  go: 'go',
  golang: 'go',
  rust: 'rust',
  rs: 'rust',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
  docker: 'docker',
  dockerfile: 'docker',
  graphql: 'graphql',
  gql: 'graphql',
  php: 'php',
  ruby: 'ruby',
  rb: 'ruby',
  kotlin: 'kotlin',
  kt: 'kotlin',
  swift: 'swift'
};

// Formatted display names for the IDE header bar
const LANGUAGE_DISPLAY_NAMES = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'React JSX',
  tsx: 'React TSX',
  python: 'Python',
  bash: 'Bash / Shell',
  markup: 'HTML / XML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  sql: 'SQL',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  yaml: 'YAML',
  markdown: 'Markdown',
  docker: 'Dockerfile',
  graphql: 'GraphQL',
  php: 'PHP',
  ruby: 'Ruby',
  kotlin: 'Kotlin',
  swift: 'Swift'
};

/**
 * Escapes raw text for safe HTML rendering
 */
export function escapeHtml(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Highlights a code snippet with Prism, or safely falls back to escaped plain text.
 * 
 * @param {string} code - Raw code string
 * @param {string} rawLang - Language identifier from markdown fence (e.g. "javascript", "js", "python")
 * @returns {{ highlightedHtml: string, resolvedLang: string, displayName: string }}
 */
export function highlightCode(code, rawLang = '') {
  const safeCode = typeof code === 'string' ? code : '';
  
  // Clean raw language tag (e.g., "javascript:index.js" or "js {1-3}" -> "javascript" / "js")
  const match = (rawLang || '').trim().match(/^([^\s:{]+)/);
  const requestedLang = match ? match[1].toLowerCase() : '';
  
  const resolvedLang = LANGUAGE_ALIASES[requestedLang] || requestedLang;
  const grammar = Prism.languages[resolvedLang];
  const displayName = LANGUAGE_DISPLAY_NAMES[resolvedLang] || (requestedLang ? requestedLang.toUpperCase() : 'CODE');

  if (grammar) {
    try {
      const highlightedHtml = Prism.highlight(safeCode, grammar, resolvedLang);
      return {
        highlightedHtml,
        resolvedLang,
        displayName
      };
    } catch (err) {
      console.warn(`[syntaxHighlight] Highlighting failed for language "${resolvedLang}":`, err);
    }
  }

  // Fallback to escaped plain text
  return {
    highlightedHtml: escapeHtml(safeCode),
    resolvedLang: resolvedLang || 'text',
    displayName
  };
}

export default highlightCode;
