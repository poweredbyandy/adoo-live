(function (global) {
  const SVG_ATTRS = 'viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"';

  const ICONS = {
    'chevron-left': `<svg ${SVG_ATTRS}><path d="M10 12 6 8l4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    'chevron-right': `<svg ${SVG_ATTRS}><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    'chevron-up': `<svg ${SVG_ATTRS}><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    'chevron-down': `<svg ${SVG_ATTRS}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    reload: `<svg ${SVG_ATTRS}><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 3.5V8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    home: `<svg ${SVG_ATTRS}><path d="M2.5 6.5 8 2l5.5 4.5V13a1 1 0 0 1-1 1h-3.5v-4h-3v4H3.5a1 1 0 0 1-1-1V6.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    menu: `<svg ${SVG_ATTRS}><path d="M2.5 4h11M2.5 8h11M2.5 12h11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    close: `<svg ${SVG_ATTRS}><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    plus: `<svg ${SVG_ATTRS}><path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    search: `<svg ${SVG_ATTRS}><circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 10l3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    settings: `<svg ${SVG_ATTRS}><circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    'external-link': `<svg ${SVG_ATTRS}><path d="M6.5 9.5H3.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v3M9 2.5h4.5V7M6.5 9.5 12.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    folder: `<svg ${SVG_ATTRS}><path d="M2.5 4.5h4l1.5 1.5H13a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    trash: `<svg ${SVG_ATTRS}><path d="M3 4.5h10M5.5 4.5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1M6 7v4.5M10 7v4.5M4 4.5l.5 8a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1l.5-8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    star: `<svg ${SVG_ATTRS}><path d="M8 2.5l1.55 3.14 3.45.5-2.5 2.43.59 3.44L8 10.27l-3.49 1.84.59-3.44-2.5-2.43 3.45-.5L8 2.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    edit: `<svg ${SVG_ATTRS}><path d="M10.5 2.5l3 3L5.5 13.5H2.5v-3L10.5 2.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    download: `<svg ${SVG_ATTRS}><path d="M8 2.5v7M5 7.5l3 3 3-3M3.5 13.5h9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    history: `<svg ${SVG_ATTRS}><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 3.5V8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    logs: `<svg ${SVG_ATTRS}><path d="M3 4.5h10M3 8h7M3 11.5h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    copy: `<svg ${SVG_ATTRS}><rect x="5.5" y="5.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.5 10.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
    export: `<svg ${SVG_ATTRS}><path d="M8 2.5v7M5 7.5l3 3 3-3M3.5 13.5h9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    help: `<svg ${SVG_ATTRS}><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.2 6.1a2 2 0 1 1 3.3 1.5c-.8.7-1.5 1-1.5 2.4M8 12.2v.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    code: `<svg ${SVG_ATTRS}><path d="M5 5.5 2.5 8l2.5 2.5M11 5.5 13.5 8 11 10.5M9 3l-2 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    minus: `<svg ${SVG_ATTRS}><path d="M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  };

  function iconHtml(name) {
    return ICONS[name] || '';
  }

  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-ui-icon]').forEach((node) => {
      const name = node.getAttribute('data-ui-icon');
      const html = iconHtml(name);
      if (!html) {
        return;
      }
      if (
        node.tagName === 'BUTTON'
        && !node.querySelector('.ui-btn__label')
        && !node.textContent.trim()
      ) {
        node.innerHTML = html;
        return;
      }
      if (
        node.classList.contains('menu-item-icon')
        || node.classList.contains('ui-nav-item__icon')
        || node.classList.contains('ui-icon')
        || node.classList.contains('menu-group-icon')
      ) {
        node.innerHTML = html;
        return;
      }
      const wrap = document.createElement('span');
      wrap.className = 'ui-icon';
      wrap.innerHTML = html;
      node.prepend(wrap);
    });
  }

  global.UIIcons = { ICONS, iconHtml, hydrateIcons };
})(window);
