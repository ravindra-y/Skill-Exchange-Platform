import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import 'github-markdown-css/github-markdown-light.css';

export default function MarkdownRenderer({ content, className = '' }) {
  // Parse markdown to raw HTML
  const rawHtml = marked.parse(content || '', {
    breaks: true, // Convert \n to <br>
    gfm: true, // GitHub Flavored Markdown
  });
  
  // Sanitize HTML to prevent XSS
  const sanitizedHtml = DOMPurify.sanitize(rawHtml);

  // Render via dangerouslySetInnerHTML
  return (
    <div 
      className={`markdown-body ${className}`} 
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }} 
    />
  );
}
