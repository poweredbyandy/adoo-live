(function (global) {
  const { iconHtml } = global.UIIcons;

  function classes(...parts) {
    return parts.filter(Boolean).join(' ');
  }

  function el(tag, className, attrs = {}, children = []) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (key === 'dataset') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          node.dataset[dataKey] = dataValue;
        });
        return;
      }
      if (key === 'aria') {
        Object.entries(value).forEach(([ariaKey, ariaValue]) => {
          node.setAttribute(`aria-${ariaKey}`, ariaValue);
        });
        return;
      }
      node.setAttribute(key, value);
    });
    children.forEach((child) => {
      if (child === null || child === undefined) {
        return;
      }
      if (typeof child === 'string') {
        node.appendChild(document.createTextNode(child));
      } else {
        node.appendChild(child);
      }
    });
    return node;
  }

  function createIcon(name) {
    const span = el('span', 'ui-icon');
    span.innerHTML = iconHtml(name);
    return span;
  }

  function createButton(options = {}) {
    const variant = options.variant || 'secondary';
    const btn = el(
      'button',
      classes(
        'ui-btn',
        variant === 'primary' && 'ui-btn--primary',
        variant === 'ghost' && 'ui-btn--ghost',
        variant === 'danger' && 'ui-btn--danger',
        options.icon && !options.label && 'ui-btn--icon',
        options.className,
      ),
      {
        type: options.type || 'button',
        title: options.title,
        id: options.id,
        'aria-label': options.ariaLabel || options.title,
      },
    );
    if (options.icon) {
      btn.appendChild(createIcon(options.icon));
    }
    if (options.label) {
      btn.appendChild(el('span', 'ui-btn__label', {}, [options.label]));
    }
    if (options.onClick) {
      btn.addEventListener('click', options.onClick);
    }
    if (options.disabled) {
      btn.disabled = true;
    }
    return btn;
  }

  function createBadge(text, tone = 'accent') {
    return el('span', classes('ui-badge', tone === 'muted' && 'ui-badge--muted'), {}, [text]);
  }

  function createList(className = '') {
    return el('div', classes('ui-list', className));
  }

  function createListSection(title) {
    const section = el('section', 'ui-list-section');
    if (title) {
      section.appendChild(el('h2', 'ui-list-section__title', {}, [title]));
    }
    const list = createList();
    section.appendChild(list);
    return { section, list };
  }

  function createListRow(options = {}) {
    const tag = options.interactive ? 'button' : 'div';
    const row = el(
      tag,
      classes('ui-list__item', options.interactive && 'ui-list__item--interactive', options.className),
      {
        type: options.interactive ? 'button' : undefined,
        title: options.title,
      },
    );

    const content = el('div', 'ui-list__content');
    if (options.primary) {
      const primary = el('div', 'ui-list__primary');
      options.primary.forEach((node) => primary.appendChild(node));
      content.appendChild(primary);
    }
    if (options.titleText) {
      content.appendChild(el('span', 'ui-list__title', {}, [options.titleText]));
    }
    if (options.meta) {
      content.appendChild(el('span', 'ui-list__meta', {}, [options.meta]));
    }
    if (options.caption) {
      content.appendChild(el('span', 'ui-list__caption', {}, [options.caption]));
    }
    row.appendChild(content);

    if (options.aside) {
      row.appendChild(el('span', 'ui-list__aside', {}, [options.aside]));
    }
    if (options.actions?.length) {
      const actions = el('div', 'ui-list__actions');
      options.actions.forEach((action) => actions.appendChild(action));
      row.appendChild(actions);
    }
    if (options.onClick) {
      row.addEventListener('click', options.onClick);
    }
    return row;
  }

  function createPageHeader(title, subtitle) {
    const header = el('header', 'ui-page-header');
    header.appendChild(el('h1', 'ui-page-header__title', {}, [title]));
    if (subtitle) {
      header.appendChild(el('p', 'ui-page-header__subtitle', {}, [subtitle]));
    }
    return header;
  }

  global.UI = {
    el,
    classes,
    createIcon,
    createButton,
    createBadge,
    createList,
    createListSection,
    createListRow,
    createPageHeader,
  };
})(window);
