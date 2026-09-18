import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import 'github-markdown-css/github-markdown-light.css';

// Build custom renderer compatible with marked v5+
const renderer = {
  code(token) {
    // In marked v5+, the argument is a token object with .text and .lang
    const code = typeof token === 'string' ? token : (token.text || '');
    const language = typeof token === 'string' ? '' : (token.lang || '');
    const lang = language || 'text';

    // Escape for safe HTML attribute embedding
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const copyIcon = `<svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

    return `<div class="relative group-code my-6 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">${lang}</span>
        <button class="copy-code-btn text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1 bg-white px-2 py-1 rounded shadow-sm border border-gray-200" data-code="${escapedCode}">
          ${copyIcon} Copy
        </button>
      </div>
      <pre class="!bg-transparent !m-0 !p-4 overflow-x-auto"><code class="language-${lang}">${escapedCode}</code></pre>
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
        // Decode HTML entities using a temporary textarea
        const txt = document.createElement('textarea');
        txt.innerHTML = encoded;
        await navigator.clipboard.writeText(txt.value);

        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<svg class="w-3.5 h-3.5" style="color:#16a34a" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> <span style="color:#16a34a">Copied!</span>`;
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
