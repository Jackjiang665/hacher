const sanitizeHtml = require('sanitize-html');
const { convert } = require('html-to-text');

const allowedTags = [
  'p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark',
  'small', 'sub', 'sup', 'center', 'font', 'ul', 'ol', 'li', 'blockquote', 'pre',
  'code', 'h1', 'h2', 'h3', 'h4', 'table', 'caption', 'colgroup', 'col',
  'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'hr', 'a', 'img',
];

const safeStyleValue = /^(?!.*(?:url\s*\(|expression\s*\(|javascript|@import))[#(),.%\-\w\s/]+$/i;

function sanitizeRichMail(rawHtml, allowInlineImages = true) {
  return sanitizeHtml(String(rawHtml || ''), {
    allowedTags,
    allowedAttributes: {
      '*': ['style', 'align', 'dir', 'lang', 'title'],
      a: ['href', 'title', 'target', 'rel'],
      font: ['color', 'face'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding', 'referrerpolicy'],
      table: ['width', 'height', 'border', 'cellpadding', 'cellspacing', 'bgcolor', 'align'],
      col: ['width', 'span'],
      th: ['colspan', 'rowspan', 'width', 'height', 'bgcolor', 'align', 'valign'],
      td: ['colspan', 'rowspan', 'width', 'height', 'bgcolor', 'align', 'valign'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowedStyles: {
      '*': {
        color: [safeStyleValue],
        'background-color': [safeStyleValue],
        'font-family': [safeStyleValue],
        'font-weight': [safeStyleValue],
        'font-style': [safeStyleValue],
        'text-align': [safeStyleValue],
        'text-decoration': [safeStyleValue],
        'vertical-align': [safeStyleValue],
        display: [safeStyleValue],
        width: [safeStyleValue],
        'min-width': [safeStyleValue],
        'max-width': [safeStyleValue],
        height: [safeStyleValue],
        'min-height': [safeStyleValue],
        'max-height': [safeStyleValue],
        margin: [safeStyleValue],
        'margin-top': [safeStyleValue],
        'margin-right': [safeStyleValue],
        'margin-bottom': [safeStyleValue],
        'margin-left': [safeStyleValue],
        padding: [safeStyleValue],
        'padding-top': [safeStyleValue],
        'padding-right': [safeStyleValue],
        'padding-bottom': [safeStyleValue],
        'padding-left': [safeStyleValue],
        border: [safeStyleValue],
        'border-top': [safeStyleValue],
        'border-right': [safeStyleValue],
        'border-bottom': [safeStyleValue],
        'border-left': [safeStyleValue],
        'border-color': [safeStyleValue],
        'border-style': [safeStyleValue],
        'border-width': [safeStyleValue],
        'border-radius': [safeStyleValue],
        'border-collapse': [safeStyleValue],
        'table-layout': [safeStyleValue],
        'white-space': [safeStyleValue],
      },
    },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: { href: attribs.href || '', title: attribs.title || '', target: '_blank', rel: 'noreferrer noopener' },
      }),
      img: (_tagName, attribs) => {
        const originalSrc = String(attribs.src || '').trim();
        const src = originalSrc.startsWith('//') ? `https:${originalSrc}` : originalSrc;
        const safeInline = allowInlineImages && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src);
        const safeRemote = /^https?:\/\/[^\s]+$/i.test(src);
        if (!safeInline && !safeRemote) return { tagName: 'span', text: '[无法显示的图片]' };
        return {
          tagName: 'img',
          attribs: {
            src,
            alt: attribs.alt || '邮件图片',
            title: attribs.title || '',
            width: attribs.width || '',
            height: attribs.height || '',
            loading: 'lazy',
            decoding: 'async',
            referrerpolicy: 'no-referrer',
          },
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
  const externalImageCount = (rawHtml.match(/<img\b[^>]*\bsrc\s*=\s*["']?(?:https?:)?\/\//gi) || []).length;
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
  return { html, text: text.slice(0, 200000), externalImageCount, inlineImagesOmitted };
}

module.exports = { cleanPlainText, prepareMailContent };
