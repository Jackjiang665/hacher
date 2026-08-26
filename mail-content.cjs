const sanitizeHtml = require('sanitize-html');
const { convert } = require('html-to-text');

const allowedTags = [
  'p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'hr', 'a', 'img',
];

function sanitizeRichMail(rawHtml, allowInlineImages = true) {
  return sanitizeHtml(String(rawHtml || ''), {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['data'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: { href: attribs.href || '', title: attribs.title || '', target: '_blank', rel: 'noreferrer noopener' },
      }),
      img: (_tagName, attribs) => {
        const src = String(attribs.src || '');
        const safeInline = allowInlineImages && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src);
        if (!safeInline) return { tagName: 'span', text: '[图片已隐藏]' };
        return {
          tagName: 'img',
          attribs: { src, alt: attribs.alt || '邮件内嵌图片', title: attribs.title || '' },
        };
      },
    },
  }).trim();
}

function cleanPlainText(value) {
  let text = String(value || '')
    .replace(/\\(?=\r?\n)/g, '')
    .replace(/(?:^|\s)(?:p|ul|ol|li|div|span)(?:\s*,\s*(?:p|ul|ol|li|div|span))*\s*\{[^}]*\}/gi, ' ');
  if (/&(?:nbsp|amp|lt|gt|quot|#\d+|#x[\da-f]+);|<\/?[a-z][^>]*>/i.test(text)) {
    text = convert(text, {
      wordwrap: false,
      preserveNewlines: true,
      selectors: [
        { selector: 'style', format: 'skip' },
        { selector: 'script', format: 'skip' },
        { selector: 'img', format: 'skip' },
      ],
    });
  }
  return text.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function prepareMailContent(parsed = {}) {
  const rawHtml = typeof parsed.html === 'string' ? parsed.html : '';
  const blockedExternalImages = (rawHtml.match(/<img\b[^>]*\bsrc\s*=\s*["']?https?:/gi) || []).length;
  let html = rawHtml ? sanitizeRichMail(rawHtml, true) : '';
  let inlineImagesOmitted = false;
  if (Buffer.byteLength(html, 'utf8') > 3 * 1024 * 1024) {
    html = sanitizeRichMail(rawHtml, false);
    inlineImagesOmitted = true;
  }
  const htmlText = html ? convert(html, {
    wordwrap: false,
    preserveNewlines: true,
    selectors: [{ selector: 'img', format: 'skip' }],
  }) : '';
  const text = cleanPlainText(htmlText || parsed.text || '') || '这封邮件没有可显示的正文。';
  return { html, text: text.slice(0, 200000), blockedExternalImages, inlineImagesOmitted };
}

module.exports = { cleanPlainText, prepareMailContent };
