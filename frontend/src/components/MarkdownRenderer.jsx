import { useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import 'github-markdown-css/github-markdown-light.css';
import '../styles/ide-theme.css';
import { highlightCode } from '../utils/syntaxHighlight';

// Build custom renderer compatible with marked v5+ & marked v18+
const renderer = {
  code(token) {
    // In marked v5+, the argument is a token object with .text and .lang
    const code = typeof token === 'string' ? token : (token.text ?? '');
    const rawLang = typeof token === 'string' ? (arguments[1] || '') : (token.lang || '');

    const { highlightedHtml, resolvedLang, displayName } = highlightCode(code, rawLang);
    const encodedForCopy = encodeURIComponent(code);

    const copyIcon = `<svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

    return `<div class="ide-code-container relative group-code my-6 rounded-xl border border-[#333338] bg-[#1e1e1e] overflow-hidden shadow-lg font-mono">
      <div class="ide-code-header flex items-center justify-between px-4 py-2.5 bg-[#252526] border-b border-[#333338] select-none">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5">
            <span class="ide-dot ide-dot-red"></span>
            <span class="ide-dot ide-dot-yellow"></span>
            <span class="ide-dot ide-dot-green"></span>
          </div>
          <span class="h-3.5 w-px bg-zinc-700/60"></span>
          <span class="text-xs font-medium text-zinc-400 tracking-wide font-sans">${displayName}</span>
        </div>
        <button class="copy-code-btn text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-all flex items-center gap-1.5 bg-[#2d2d30] hover:bg-[#3e3e42] px-2.5 py-1 rounded-md shadow-sm border border-[#3e3e42]" data-code="${encodedForCopy}">
          ${copyIcon} <span>Copy</span>
        </button>
      </div>
      <pre class="!bg-[#1e1e1e] !m-0 !p-4 sm:!p-5 overflow-x-auto text-[13.5px] leading-relaxed"><code class="ide-code-block language-${resolvedLang}">${highlightedHtml}</code></pre>
    </div>`;
  }
};

marked.use({ renderer });

export default function MarkdownRenderer({ content, className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const btns = containerRef.current.querySelectorAll('.copy-code-btn');

    const handleCopy = async (e) => {
      const btn = e.currentTarget;
      const encoded = btn.getAttribute('data-code');
      if (!encoded) return;
      try {
        let codeToCopy;
        try {
          codeToCopy = decodeURIComponent(encoded);
        } catch {
          const txt = document.createElement('textarea');
          txt.innerHTML = encoded;
          codeToCopy = txt.value;
        }
        await navigator.clipboard.writeText(codeToCopy);

        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> <span class="text-emerald-400">Copied!</span>`;
        setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
      } catch (err) {
        console.error('Failed to copy code', err);
      }
    };

    btns.forEach(btn => btn.addEventListener('click', handleCopy));
    return () => btns.forEach(btn => btn.removeEventListener('click', handleCopy));
  }, [content]);

  // Parse markdown → HTML
  const rawHtml = marked.parse(content || '', { breaks: true, gfm: true });

  // Sanitize — allow data-code attribute needed for copy button
  const sanitizedHtml = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['data-code'],
  });

  return (
    <div
      ref={containerRef}
      className={`markdown-body bg-transparent ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
