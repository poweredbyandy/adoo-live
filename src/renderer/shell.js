const TAB_TYPES = {
  ODOO: 'odoo',
  HOME: 'home',
  LOGS: 'logs',
  HISTORY: 'history',
  DOWNLOADS: 'downloads',
  SETTINGS: 'settings',
};

const isMenuOverlay = new URLSearchParams(window.location.search).get('overlay') === 'menu';
if (isMenuOverlay) {
  document.documentElement.classList.add('menu-overlay-host');
}

function t(msgid, params) {
  return window.i18n?.t(msgid, params) ?? msgid;
}

function getApi() {
  if (!window.shellAPI) {
    throw new Error(t('shellAPI is not available. Preload did not load correctly.'));
  }
  return window.shellAPI;
}

function describeBrowserState(state) {
  if (!state || typeof state !== 'object') {
    return t('Completed');
  }
  const parts = [];
  if (state.mode) {
    parts.push(`${t('Mode changed')}=${state.mode}`);
  }
  if (state.activeTabType) {
    parts.push(`view=${state.activeTabType}`);
  }
  if (state.menuOpen !== undefined) {
    parts.push(`${t('Menu')}=${state.menuOpen ? t('Open menu') : t('Close menu')}`);
  }
  if (state.currentUrl) {
    parts.push(`url=${state.currentUrl}`);
  }
  if (state.zoomLevel !== undefined) {
    parts.push(`zoom=${zoomToPercent(state.zoomLevel)}`);
  }
  return parts.join(', ') || t('Completed');
}

function describeClickResult(result, options = {}) {
  if (options.describe) {
    return options.describe(result);
  }
  if (result && typeof result === 'object' && result.mode && result.capabilities) {
    return describeBrowserState(result);
  }
  if (result && typeof result === 'object' && result.activeTabType) {
    return describeBrowserState(result);
  }
  if (typeof result === 'boolean') {
    return result ? t('Enabled') : t('Disabled');
  }
  if (typeof result === 'string' && result) {
    return result;
  }
  if (result === undefined || result === null) {
    return t('Completed');
  }
  return 'ok';
}

async function runAction(action, meta = null) {
  const api = getApi();
  const options = typeof meta === 'string' ? { label: meta } : (meta || {});
  const label = options.label;

  if (label && options.target?.disabled) {
    await api.appendLog({
      level: 'warn',
      source: 'click',
      message: label,
      detail: t('No effect (control disabled)'),
    });
    return null;
  }

  if (label) {
    await api.appendLog({
      level: 'info',
      source: 'click',
      message: label,
      detail: t('Started'),
    });
  }

  try {
    const result = await action(api);
    if (label) {
      await api.appendLog({
        level: 'info',
        source: 'click',
        message: label,
        detail: describeClickResult(result, options),
      });
    }
    return result;
  } catch (error) {
    const message = error?.message || String(error);
    if (label) {
      await api.appendLog({
        level: 'error',
        source: 'click',
        message: label,
        detail: `error: ${message}`,
      });
    } else {
      await api.appendLog({ level: 'error', source: 'shell-ui', message });
    }
    window.alert(message);
    throw error;
  }
}

const elements = {
  body: document.body,
  chrome: document.getElementById('chrome'),
  btnBack: document.getElementById('btn-back'),
  btnForward: document.getElementById('btn-forward'),
  btnReload: document.getElementById('btn-reload'),
  btnHome: document.getElementById('btn-home'),
  urlInput: document.getElementById('url-input'),
  urlDisplay: document.getElementById('url-display'),
  titlebar: document.getElementById('titlebar'),
  titlebarDrag: document.getElementById('titlebar-drag'),
  tabsBar: document.getElementById('tabs-bar'),
  tabsList: document.getElementById('tabs-list'),
  btnNewTab: document.getElementById('btn-new-tab'),
  findBar: document.getElementById('find-bar'),
  findInput: document.getElementById('find-input'),
  findStatus: document.getElementById('find-status'),
  btnFindPrev: document.getElementById('btn-find-prev'),
  btnFindNext: document.getElementById('btn-find-next'),
  btnFindClose: document.getElementById('btn-find-close'),
  printBanner: document.getElementById('print-banner'),
  printNotices: document.getElementById('print-notices'),
  btnMenu: document.getElementById('btn-menu'),
  btnMenuClose: document.getElementById('btn-menu-close'),
  menuPanel: document.getElementById('menu-panel'),
  menuBackdrop: document.getElementById('menu-backdrop'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomReset: document.getElementById('btn-zoom-reset'),
  modeSegment: document.getElementById('mode-segment'),
  modeItems: Array.from(document.querySelectorAll('.mode-segment-option')),
  languageSelect: document.getElementById('language-select'),
  menuItems: Array.from(document.querySelectorAll('.menu-item[data-action]')),
  shellContent: document.getElementById('shell-content'),
  panelHome: document.getElementById('panel-home'),
  panelLogs: document.getElementById('panel-logs'),
  panelHistory: document.getElementById('panel-history'),
  panelDownloads: document.getElementById('panel-downloads'),
  settingsModal: document.getElementById('settings-modal'),
  settingsModalBackdrop: document.getElementById('settings-modal-backdrop'),
  btnSettingsClose: document.getElementById('btn-settings-close'),
  settingsAboutList: document.getElementById('settings-about-list'),
  settingsAppIcon: document.getElementById('settings-app-icon'),
  settingsAppName: document.getElementById('settings-app-name'),
  settingsAppVersion: document.getElementById('settings-app-version'),
  settingsUpdateStatus: document.getElementById('settings-update-status'),
  btnCheckUpdates: document.getElementById('btn-check-updates'),
  btnDownloadUpdate: document.getElementById('btn-download-update'),
  btnInstallUpdate: document.getElementById('btn-install-update'),
  btnFactoryReset: document.getElementById('btn-factory-reset'),
  settingsDownloadPath: document.getElementById('settings-download-path'),
  btnPickDownloadFolder: document.getElementById('btn-pick-download-folder'),
  btnResetDownloadFolder: document.getElementById('btn-reset-download-folder'),
  settingsLogsPreview: document.getElementById('settings-logs-preview'),
  settingsNavItems: Array.from(document.querySelectorAll('.settings-nav-item')),
  settingsPanels: Array.from(document.querySelectorAll('.settings-panel')),
  permissionToggles: Array.from(document.querySelectorAll('.settings-permission-toggle')),
  permissionMeta: Array.from(document.querySelectorAll('[data-permission-meta]')),
  homeInstances: document.getElementById('home-instances'),
  homeEmpty: document.getElementById('home-empty'),
  homeInstanceForm: document.getElementById('home-instance-form'),
  homeInstanceLabel: document.getElementById('home-instance-label'),
  homeInstanceUrl: document.getElementById('home-instance-url'),
  logsContent: document.getElementById('logs-content'),
  historyList: document.getElementById('history-list'),
  historyEmpty: document.getElementById('history-empty'),
  historyNoResults: document.getElementById('history-no-results'),
  historySearch: document.getElementById('history-search'),
  historyCount: document.getElementById('history-count'),
  btnHistoryClear: document.getElementById('btn-history-clear'),
  downloadsList: document.getElementById('downloads-list'),
  downloadsEmpty: document.getElementById('downloads-empty'),
  bootError: document.getElementById('boot-error'),
  keymapList: document.getElementById('keymap-list'),
};

const panels = {
  [TAB_TYPES.HOME]: elements.panelHome,
  [TAB_TYPES.LOGS]: elements.panelLogs,
  [TAB_TYPES.HISTORY]: elements.panelHistory,
  [TAB_TYPES.DOWNLOADS]: elements.panelDownloads,
};

let settingsModalOpen = false;
let settingsAboutInfo = null;
let settingsUpdateState = {
  checking: false,
  downloading: false,
  updateAvailable: false,
  upToDate: false,
  canAutoUpdate: false,
  readyToInstall: false,
  currentVersion: '',
  latestVersion: '',
  releaseUrl: '',
  message: '',
};

const DRAG_MIME = 'application/x-odoo-kiosk-tab';

let currentState = null;
let lastFindQuery = '';
let findInputTimer = null;
let dragSession = {
  active: false,
  tabId: null,
  windowId: null,
  dropped: false,
};

let refreshMenuDrawerScrollbar = null;
let historySearchQuery = '';

const HISTORY_GROUP_ORDER = ['Today', 'Yesterday', 'Last 7 days', 'Earlier'];

function zoomToPercent(level) {
  return `${Math.round(Math.pow(1.2, level) * 100)}%`;
}

function zoomToFactor(level) {
  return Math.pow(1.2, level || 0);
}

function applyPanelZoom(zoomLevel, isOdooTabActive) {
  if (!elements.shellContent) {
    return;
  }
  if (isOdooTabActive) {
    elements.shellContent.style.zoom = '';
    return;
  }
  elements.shellContent.style.zoom = String(zoomToFactor(zoomLevel));
}

function formatDate(iso) {
  if (!iso) {
    return '';
  }
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatHistoryPath(urlString) {
  try {
    const url = new URL(urlString);
    const path = `${url.pathname}${url.search}${url.hash}`;
    return path && path !== '/' ? path : '/';
  } catch {
    return urlString;
  }
}

function formatRelativeHistoryDate(iso) {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) {
    return t('Now');
  }
  if (diffMin < 60) {
    return t('%(minutes)s min ago', { minutes: diffMin });
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (date >= startOfToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (date >= startOfYesterday) {
    return t('Yesterday %(time)s', {
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  }
  return formatDate(iso);
}

function getHistoryDateGroup(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Earlier';
  }
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  if (date >= startOfToday) {
    return 'Today';
  }
  if (date >= startOfYesterday) {
    return 'Yesterday';
  }
  if (date >= startOfWeek) {
    return 'Last 7 days';
  }
  return 'Earlier';
}

function filterHistoryEntries(pageHistory, query) {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) {
    return pageHistory || [];
  }
  return (pageHistory || []).filter((entry) => {
    const haystack = [
      entry.title,
      entry.url,
      entry.host,
      formatHistoryPath(entry.url),
    ].join(' ').toLowerCase();
    return haystack.includes(normalized);
  });
}

function groupHistoryEntries(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const label = getHistoryDateGroup(entry.visitedAt);
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label).push(entry);
  });
  return HISTORY_GROUP_ORDER
    .filter((label) => groups.has(label))
    .map((label) => ({ label, entries: groups.get(label) }));
}

function openHistoryEntry(entry) {
  runAction((api) => api.newTab(entry.url), {
    label: `Historial: ${entry.title || entry.url}`,
    describe: describeBrowserState,
  });
}

function createHistoryItem(entry) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'history-item';
  item.title = entry.url;

  const main = document.createElement('span');
  main.className = 'history-item-main';

  const top = document.createElement('span');
  top.className = 'history-item-top';

  const host = document.createElement('span');
  host.className = 'history-item-host';
  host.textContent = entry.host || 'web';

  const title = document.createElement('span');
  title.className = 'history-item-title';
  title.textContent = entry.title || entry.url;

  const path = document.createElement('span');
  path.className = 'history-item-path';
  path.textContent = formatHistoryPath(entry.url);

  const time = document.createElement('span');
  time.className = 'history-item-time';
  time.textContent = formatRelativeHistoryDate(entry.visitedAt);

  top.appendChild(host);
  top.appendChild(title);
  main.appendChild(top);
  main.appendChild(path);
  item.appendChild(main);
  item.appendChild(time);
  item.addEventListener('click', () => openHistoryEntry(entry));
  return item;
}

function getModeLabel(mode) {
  if (mode === 'kiosk') {
    return t('Kiosk');
  }
  if (mode === 'free') {
    return t('Window');
  }
  if (mode === 'developer') {
    return t('Developer');
  }
  return mode;
}

function syncI18nFromState(state) {
  if (!state?.i18nCatalog || !window.i18n) {
    return;
  }
  window.i18n.initClientI18n(state.locale, state.i18nCatalog);
  window.i18n.applyStaticI18n();
  updateLanguageSelect(state.locale);
}

function updateLanguageSelect(locale) {
  if (!elements.languageSelect) {
    return;
  }
  elements.languageSelect.value = locale;
}

function updateModeSwitches(activeMode) {
  if (elements.modeSegment) {
    elements.modeSegment.classList.toggle('is-kiosk', activeMode === 'kiosk');
    elements.modeSegment.classList.toggle('is-ventana', activeMode === 'free');
  }
  elements.modeItems.forEach((button) => {
    const isActive = button.dataset.mode === activeMode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function applyMenuVisibility(menuOpen) {
  const isOpen = Boolean(menuOpen);
  elements.menuPanel.classList.toggle('hidden', !isOpen);
  elements.menuBackdrop.classList.toggle('hidden', !isOpen);
  elements.menuPanel.setAttribute('aria-hidden', String(!isOpen));
  if (isOpen) {
    requestMenuDrawerScrollbarRefresh();
  }
}

function requestMenuDrawerScrollbarRefresh() {
  if (refreshMenuDrawerScrollbar) {
    requestAnimationFrame(refreshMenuDrawerScrollbar);
  }
}

function setupMenuDrawerScrollbar() {
  const scroller = document.getElementById('menu-drawer-scroll');
  const track = document.querySelector('.menu-drawer-scrollbar');
  const thumb = document.querySelector('.menu-drawer-scrollbar-thumb');
  if (!scroller || !track || !thumb) {
    refreshMenuDrawerScrollbar = null;
    return;
  }

  let hideTimer = null;
  let dragPointerId = null;
  let dragStartY = 0;
  let dragStartScrollTop = 0;

  function clearHideTimer() {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      if (dragPointerId === null) {
        track.classList.remove('is-visible');
      }
    }, 850);
  }

  function showScrollbar() {
    track.classList.add('is-visible');
    scheduleHide();
  }

  function updateThumb() {
    const { scrollHeight, clientHeight, scrollTop } = scroller;
    if (scrollHeight <= clientHeight + 1) {
      track.classList.add('is-hidden');
      track.classList.remove('is-visible');
      return;
    }
    track.classList.remove('is-hidden');
    const ratio = clientHeight / scrollHeight;
    const thumbHeight = Math.max(28, Math.round(clientHeight * ratio));
    const maxThumbTop = clientHeight - thumbHeight;
    const scrollRange = scrollHeight - clientHeight;
    const thumbTop = scrollRange > 0 && maxThumbTop > 0
      ? (scrollTop / scrollRange) * maxThumbTop
      : 0;
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translate3d(0, ${thumbTop}px, 0)`;
  }

  function refresh() {
    updateThumb();
  }

  scroller.addEventListener('scroll', () => {
    updateThumb();
    showScrollbar();
  }, { passive: true });

  scroller.addEventListener('wheel', showScrollbar, { passive: true });

  track.addEventListener('mouseenter', () => {
    track.classList.add('is-visible');
    clearHideTimer();
  });

  track.addEventListener('mouseleave', () => {
    if (dragPointerId === null) {
      track.classList.remove('is-visible');
    }
  });

  thumb.addEventListener('pointerdown', (event) => {
    dragPointerId = event.pointerId;
    dragStartY = event.clientY;
    dragStartScrollTop = scroller.scrollTop;
    track.classList.add('is-dragging', 'is-visible');
    thumb.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  thumb.addEventListener('pointermove', (event) => {
    if (dragPointerId !== event.pointerId) {
      return;
    }
    const { scrollHeight, clientHeight } = scroller;
    const thumbHeight = thumb.offsetHeight;
    const maxThumbTop = Math.max(0, clientHeight - thumbHeight);
    const scrollRange = Math.max(0, scrollHeight - clientHeight);
    if (maxThumbTop <= 0 || scrollRange <= 0) {
      return;
    }
    const deltaY = event.clientY - dragStartY;
    const scrollDelta = (deltaY / maxThumbTop) * scrollRange;
    scroller.scrollTop = dragStartScrollTop + scrollDelta;
  });

  const endDrag = (event) => {
    if (dragPointerId !== event.pointerId) {
      return;
    }
    dragPointerId = null;
    track.classList.remove('is-dragging');
    if (thumb.hasPointerCapture(event.pointerId)) {
      thumb.releasePointerCapture(event.pointerId);
    }
    scheduleHide();
  };

  thumb.addEventListener('pointerup', endDrag);
  thumb.addEventListener('pointercancel', endDrag);

  track.addEventListener('pointerdown', (event) => {
    if (event.target === thumb) {
      return;
    }
    const rect = track.getBoundingClientRect();
    const clickY = event.clientY - rect.top;
    const thumbTop = Number.parseFloat(thumb.style.transform.match(/[\d.]+/)?.[0] || '0');
    const thumbMiddle = thumbTop + thumb.offsetHeight / 2;
    scroller.scrollTop += clickY < thumbMiddle
      ? -scroller.clientHeight * 0.85
      : scroller.clientHeight * 0.85;
    showScrollbar();
    updateThumb();
  });

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(refresh);
    observer.observe(scroller);
  }

  window.addEventListener('resize', refresh);
  refreshMenuDrawerScrollbar = refresh;
  refresh();
}

function setMenuOpen(open, label = null) {
  const isOpen = Boolean(open);
  const actionLabel = label || (isOpen ? t('Open menu') : t('Close menu'));
  const run = (api) => api.setMenuOpen(isOpen);
  const meta = {
    label: actionLabel,
    describe: (state) => (state.menuOpen ? 'menú abierto' : 'menú cerrado'),
  };
  if (isMenuOverlay) {
    runAction(run, meta);
    return;
  }
  runAction(run, meta);
}

function closeMenu() {
  setMenuOpen(false, t('Close menu'));
}

function toggleMenu() {
  if (isMenuOverlay) {
    closeMenu();
    return;
  }
  const willOpen = !elements.btnMenu?.classList.contains('active');
  setMenuOpen(willOpen, willOpen ? `${t('Open menu')} ☰` : `${t('Close menu')} ☰`);
}

function formatLogEntry(entry) {
  const detail = entry.detail ? ` | ${entry.detail}` : '';
  return `[${entry.timestamp}] [${entry.level}] [${entry.source}] ${entry.message}${detail}`;
}

function renderLogs(logs) {
  elements.logsContent.textContent = (logs || []).map(formatLogEntry).join('\n');
  elements.logsContent.scrollTop = elements.logsContent.scrollHeight;
}

function renderHomeInstances(instanceData) {
  elements.homeInstances.innerHTML = '';
  const list = instanceData?.items || [];
  const defaultInstanceId = instanceData?.defaultInstanceId || null;
  elements.homeEmpty.classList.toggle('hidden', list.length > 0);
  list.forEach((instance) => {
    const card = document.createElement('div');
    card.className = 'instance-card';

    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'panel-item instance-open';

    const title = document.createElement('span');
    title.className = 'panel-item-title';
    title.textContent = instance.label || instance.host || t('Instance');

    const meta = document.createElement('span');
    meta.className = 'panel-item-meta';
    meta.textContent = instance.baseUrl;

    const status = document.createElement('span');
    status.className = 'panel-item-date';
    status.textContent = instance.id === defaultInstanceId ? t('Default') : t('Configured');

    openButton.appendChild(title);
    openButton.appendChild(meta);
    openButton.appendChild(status);
    openButton.addEventListener('click', () => {
      runAction((api) => api.newTab(instance.baseUrl), {
        label: `Inicio: abrir ${instance.label || instance.host}`,
        describe: describeBrowserState,
      });
    });

    const actions = document.createElement('div');
    actions.className = 'instance-actions';

    const defaultButton = document.createElement('button');
    defaultButton.type = 'button';
    defaultButton.className = `instance-action-btn${instance.id === defaultInstanceId ? ' active' : ''}`;
    defaultButton.title = t('Mark as default');
    defaultButton.textContent = '★';
    defaultButton.addEventListener('click', (event) => {
      event.stopPropagation();
      runAction((api) => api.setDefaultInstance(instance.id), {
        label: `Predeterminada: ${instance.label || instance.host}`,
        describe: (snapshot) => `url=${snapshot.defaultBaseUrl}`,
      });
    });

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'instance-action-btn';
    editButton.title = t('Edit');
    editButton.textContent = '✎';
    editButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const nextLabel = window.prompt('Nombre de la instancia', instance.label || instance.host);
      if (nextLabel === null) {
        return;
      }
      const nextUrl = window.prompt('URL de la instancia', instance.baseUrl);
      if (nextUrl === null) {
        return;
      }
      runAction((api) => api.updateInstance(instance.id, { label: nextLabel, url: nextUrl }), {
        label: `Editar instancia: ${instance.label || instance.host}`,
        describe: (snapshot) => `${snapshot.items.length} instancias`,
      });
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'instance-action-btn danger';
    deleteButton.title = t('Delete');
    deleteButton.textContent = '×';
    deleteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const confirmed = window.confirm(t('Delete instance "%(name)s"?', {
        name: instance.label || instance.host,
      }));
      if (!confirmed) {
        return;
      }
      runAction((api) => api.removeInstance(instance.id), {
        label: `Eliminar instancia: ${instance.label || instance.host}`,
        describe: (snapshot) => `${snapshot.items.length} instancias`,
      });
    });

    actions.appendChild(defaultButton);
    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    card.appendChild(openButton);
    card.appendChild(actions);
    elements.homeInstances.appendChild(card);
  });
}

function renderHistory(pageHistory) {
  const allEntries = pageHistory || [];
  const filtered = filterHistoryEntries(allEntries, historySearchQuery);
  const groups = groupHistoryEntries(filtered);

  elements.historyList.innerHTML = '';
  elements.historyEmpty.classList.toggle('hidden', allEntries.length > 0);
  elements.historyNoResults.classList.toggle('hidden', allEntries.length === 0 || filtered.length > 0);
  elements.historyList.classList.toggle('hidden', filtered.length === 0);

  if (elements.btnHistoryClear) {
    elements.btnHistoryClear.disabled = allEntries.length === 0;
  }

  if (elements.historyCount) {
    if (!allEntries.length) {
      elements.historyCount.textContent = '';
    } else if (historySearchQuery) {
      elements.historyCount.textContent = t('%(filtered)s of %(total)s', {
        filtered: filtered.length,
        total: allEntries.length,
      });
    } else {
      elements.historyCount.textContent = t(allEntries.length === 1 ? '%(count)s page' : '%(count)s pages', {
        count: allEntries.length,
      });
    }
  }

  groups.forEach((group) => {
    const section = document.createElement('section');
    section.className = 'history-group';

    const label = document.createElement('h2');
    label.className = 'history-group-label';
    label.textContent = t(group.label);
    section.appendChild(label);

    group.entries.forEach((entry) => {
      section.appendChild(createHistoryItem(entry));
    });
    elements.historyList.appendChild(section);
  });
}

function bindHistoryPanel() {
  if (elements.historySearch) {
    elements.historySearch.addEventListener('input', () => {
      historySearchQuery = elements.historySearch.value.trim().toLowerCase();
      if (currentState?.panelData) {
        renderHistory(currentState.panelData.pageHistory);
      }
    });
  }

  if (elements.btnHistoryClear) {
    elements.btnHistoryClear.addEventListener('click', async () => {
      const confirmed = window.confirm(t('Clear all page history?'));
      if (!confirmed) {
        return;
      }
      historySearchQuery = '';
      if (elements.historySearch) {
        elements.historySearch.value = '';
      }
      await runAction((api) => api.clearPageHistory(), {
        label: t('Clear page history'),
        describe: () => t('Empty history'),
      });
    });
  }
}

function renderDownloads(downloads) {
  elements.downloadsList.innerHTML = '';
  const list = downloads || [];
  elements.downloadsEmpty.classList.toggle('hidden', list.length > 0);
  list.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'download-item';
    const stateLabel = entry.state === 'completed'
      ? t('Completed')
      : entry.state === 'cancelled'
        ? t('Cancelled')
        : entry.state === 'interrupted'
          ? t('Interrupted')
          : t('In progress');
    const hasFile = Boolean(entry.path) && entry.state === 'completed';

    const main = document.createElement('div');
    main.className = 'download-item-main';
    main.innerHTML = `
      <span class="panel-item-title">${entry.filename || t('Untitled')}</span>
      <span class="panel-item-meta">${entry.path || entry.url || ''}</span>
      <span class="panel-item-date">${stateLabel} · ${formatDate(entry.completedAt || entry.startedAt)}</span>
    `;
    item.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'download-item-actions';

    const openFileBtn = document.createElement('button');
    openFileBtn.type = 'button';
    openFileBtn.className = 'download-action-btn';
    openFileBtn.textContent = '↗';
    openFileBtn.title = t('Open file');
    openFileBtn.setAttribute('aria-label', t('Open file'));
    openFileBtn.disabled = !hasFile;
    openFileBtn.addEventListener('click', () => {
      runAction((api) => api.openDownloadFile(entry.id), {
        label: t('Open file'),
        describe: () => entry.filename || entry.path,
      });
    });

    const openFolderBtn = document.createElement('button');
    openFolderBtn.type = 'button';
    openFolderBtn.className = 'download-action-btn';
    openFolderBtn.textContent = '▤';
    openFolderBtn.title = t('Open folder');
    openFolderBtn.setAttribute('aria-label', t('Open folder'));
    openFolderBtn.disabled = !hasFile;
    openFolderBtn.addEventListener('click', () => {
      runAction((api) => api.openDownloadFolder(entry.id), {
        label: t('Open folder'),
        describe: () => entry.path || t('Downloads'),
      });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'download-action-btn is-danger';
    deleteBtn.textContent = '✕';
    deleteBtn.title = t('Delete file');
    deleteBtn.setAttribute('aria-label', t('Delete file'));
    deleteBtn.disabled = !hasFile;
    deleteBtn.addEventListener('click', async () => {
      const confirmed = window.confirm(t('Delete this downloaded file?'));
      if (!confirmed) {
        return;
      }
      await runAction((api) => api.removeDownload(entry.id, true), {
        label: t('Delete file'),
        describe: () => entry.filename || entry.path,
      });
    });

    actions.append(openFileBtn, openFolderBtn, deleteBtn);
    item.appendChild(actions);
    elements.downloadsList.appendChild(item);
  });
}

function renderSettingsDownloadFolder(info) {
  if (!elements.settingsDownloadPath) {
    return;
  }
  if (!info) {
    elements.settingsDownloadPath.textContent = '';
    return;
  }
  const label = info.isCustom
    ? t('Custom folder: %(path)s', { path: info.path })
    : t('System default: %(path)s', { path: info.path });
  elements.settingsDownloadPath.textContent = label;
  if (elements.btnResetDownloadFolder) {
    elements.btnResetDownloadFolder.classList.toggle('hidden', !info.isCustom);
  }
}

async function loadDownloadFolderSettings() {
  if (!elements.settingsDownloadPath) {
    return;
  }
  try {
    const info = await getApi().getDownloadFolder();
    renderSettingsDownloadFolder(info);
  } catch (error) {
    elements.settingsDownloadPath.textContent = error.message || String(error);
  }
}

function renderSettingsLogsPreview(logs) {
  if (!elements.settingsLogsPreview) {
    return;
  }
  const list = logs || [];
  elements.settingsLogsPreview.textContent = list.length
    ? list.slice(-80).map(formatLogEntry).join('\n')
    : t('No log entries yet.');
}

function renderSettingsPermissions(permissions) {
  if (!permissions) {
    return;
  }
  elements.permissionToggles.forEach((input) => {
    const type = input.dataset.permission;
    input.checked = Boolean(permissions[type]);
  });
  elements.permissionMeta.forEach((meta) => {
    const type = meta.dataset.permissionMeta;
    const grantedAt = permissions.grantedAt?.[type];
    if (permissions[type] && grantedAt) {
      meta.textContent = t('Granted on %(date)s', { date: formatDate(grantedAt) });
    } else if (permissions[type]) {
      meta.textContent = t('Enabled');
    } else {
      meta.textContent = t('Disabled');
    }
  });
}

function switchSettingsPanel(panelId) {
  elements.settingsNavItems.forEach((button) => {
    const isActive = button.dataset.settingsPanel === panelId;
    button.classList.toggle('active', isActive);
  });
  elements.settingsPanels.forEach((panel) => {
    const isActive = panel.dataset.settingsPanel === panelId;
    panel.classList.toggle('hidden', !isActive);
    panel.classList.toggle('active', isActive);
  });
  if (panelId === 'logs' && currentState?.panelData?.logs) {
    renderSettingsLogsPreview(currentState.panelData.logs);
  }
}

function createSettingsInfoRow(label, value) {
  const row = document.createElement('div');
  row.className = 'settings-info-row';
  const term = document.createElement('dt');
  term.textContent = label;
  const definition = document.createElement('dd');
  definition.textContent = value || '—';
  row.appendChild(term);
  row.appendChild(definition);
  return row;
}

function getPlatformLabel(platform) {
  if (platform === 'darwin') {
    return 'macOS';
  }
  if (platform === 'win32') {
    return 'Windows';
  }
  if (platform === 'linux') {
    return 'Linux';
  }
  return platform || '—';
}

function renderSettingsAbout(about) {
  if (!elements.settingsAboutList || !about) {
    return;
  }
  settingsAboutInfo = about;
  if (elements.settingsAppIcon && about.iconUrl) {
    elements.settingsAppIcon.src = about.iconUrl;
  }
  if (elements.settingsAppName) {
    elements.settingsAppName.textContent = about.productName || 'adoo IoT';
  }
  if (elements.settingsAppVersion) {
    elements.settingsAppVersion.textContent = t('Version %(version)s', { version: about.version || '—' });
  }
  elements.settingsAboutList.innerHTML = '';
  const rows = [
    [t('Application'), about.productName],
    [t('Version'), about.version],
    [t('Device ID'), about.deviceUid],
    [t('Hostname'), about.hostname],
    [t('Platform'), `${getPlatformLabel(about.platform)} (${about.arch})`],
    [t('Operating system'), about.osVersion],
    [t('IP address'), about.ipAddress],
    [t('Memory'), t('%(value)s GB', { value: about.totalMemoryGb })],
    [t('CPU'), about.cpuModel],
    [t('Electron'), about.electron],
    [t('Node.js'), about.node],
    [t('Install mode'), about.isPackaged ? t('Packaged app') : t('Development')],
    [t('User data'), about.userDataPath],
  ];
  rows.forEach(([label, value]) => {
    elements.settingsAboutList.appendChild(createSettingsInfoRow(label, value));
  });
}

function renderSettingsUpdateUi() {
  if (!elements.settingsUpdateStatus) {
    return;
  }
  const state = settingsUpdateState;
  elements.settingsUpdateStatus.classList.remove('is-success', 'is-warning', 'is-error');

  let message = state.message;
  if (!message) {
    if (state.checking) {
      message = t('Checking for updates...');
    } else if (state.downloading) {
      message = t('Downloading update... %(percent)s%%', {
        percent: Math.round(state.downloadPercent || 0),
      });
    } else if (state.readyToInstall) {
      message = t('Update %(version)s is ready to install.', { version: state.latestVersion });
      elements.settingsUpdateStatus.classList.add('is-warning');
    } else if (state.updateAvailable) {
      message = t('Version %(latest)s is available. You are on %(current)s.', {
        latest: state.latestVersion,
        current: state.currentVersion,
      });
      elements.settingsUpdateStatus.classList.add('is-warning');
    } else if (state.upToDate) {
      message = state.noReleasesPublished
        ? t('No published releases yet on GitHub.')
        : t('You are on the latest version (%(version)s).', { version: state.currentVersion });
      elements.settingsUpdateStatus.classList.add('is-success');
    } else {
      message = t('Check whether a new release is available on GitHub.');
    }
  } else if (state.error) {
    elements.settingsUpdateStatus.classList.add('is-error');
  }

  elements.settingsUpdateStatus.textContent = message;

  if (elements.btnCheckUpdates) {
    elements.btnCheckUpdates.disabled = state.checking || state.downloading;
  }
  if (elements.btnDownloadUpdate) {
    const showDownload = state.updateAvailable && !state.readyToInstall;
    elements.btnDownloadUpdate.classList.toggle('hidden', !showDownload);
    elements.btnDownloadUpdate.disabled = state.checking || state.downloading;
    elements.btnDownloadUpdate.textContent = state.canAutoUpdate
      ? t('Download update')
      : t('Open release page');
  }
  if (elements.btnInstallUpdate) {
    elements.btnInstallUpdate.classList.toggle('hidden', !state.readyToInstall);
    elements.btnInstallUpdate.disabled = !state.readyToInstall;
  }
}

async function loadSettingsPanel() {
  if (!elements.settingsModal) {
    return;
  }
  try {
    const about = await getApi().getAboutInfo();
    renderSettingsAbout(about);
    settingsUpdateState.currentVersion = about.version;
    renderSettingsUpdateUi();
    await loadDownloadFolderSettings();
  } catch (error) {
    settingsUpdateState.message = error.message || String(error);
    settingsUpdateState.error = true;
    renderSettingsUpdateUi();
  }
}

async function prefetchSettingsAbout() {
  if (settingsAboutInfo) {
    return;
  }
  try {
    const about = await getApi().getAboutInfo();
    renderSettingsAbout(about);
    settingsUpdateState.currentVersion = about.version;
    renderSettingsUpdateUi();
  } catch {
    void 0;
  }
}

async function checkSettingsUpdates() {
  settingsUpdateState.checking = true;
  settingsUpdateState.error = false;
  settingsUpdateState.message = '';
  renderSettingsUpdateUi();
  try {
    const result = await getApi().checkForUpdates();
    if (result.error) {
      settingsUpdateState.checking = false;
      settingsUpdateState.error = true;
      settingsUpdateState.message = result.message || t('Update failed.');
      renderSettingsUpdateUi();
      return;
    }
    settingsUpdateState = {
      ...settingsUpdateState,
      checking: false,
      downloading: false,
      updateAvailable: Boolean(result.updateAvailable),
      upToDate: Boolean(result.upToDate),
      canAutoUpdate: Boolean(result.canAutoUpdate),
      readyToInstall: false,
      currentVersion: result.currentVersion || settingsUpdateState.currentVersion,
      latestVersion: result.latestVersion || '',
      releaseUrl: result.releaseUrl || '',
      noReleasesPublished: Boolean(result.noReleasesPublished),
      message: '',
      error: false,
      downloadPercent: 0,
    };
  } catch (error) {
    settingsUpdateState.checking = false;
    settingsUpdateState.error = true;
    settingsUpdateState.message = error.message || String(error);
  }
  renderSettingsUpdateUi();
}

async function downloadSettingsUpdate() {
  settingsUpdateState.downloading = true;
  settingsUpdateState.message = '';
  settingsUpdateState.error = false;
  renderSettingsUpdateUi();
  try {
    const result = await getApi().downloadUpdate();
    if (result.mode === 'manual') {
      settingsUpdateState.downloading = false;
      settingsUpdateState.message = t('Release page opened in your browser.');
      renderSettingsUpdateUi();
      return;
    }
    settingsUpdateState.downloading = false;
    settingsUpdateState.readyToInstall = true;
    settingsUpdateState.message = t('Update downloaded. Restart to install.');
    renderSettingsUpdateUi();
  } catch (error) {
    settingsUpdateState.downloading = false;
    settingsUpdateState.error = true;
    settingsUpdateState.message = error.message || String(error);
    renderSettingsUpdateUi();
  }
}

function handleSettingsUpdateEvent(payload) {
  if (!payload || !settingsModalOpen) {
    return;
  }
  if (payload.phase === 'checking') {
    settingsUpdateState.checking = true;
    renderSettingsUpdateUi();
    return;
  }
  if (payload.phase === 'downloading') {
    settingsUpdateState.downloading = true;
    settingsUpdateState.downloadPercent = payload.percent || 0;
    renderSettingsUpdateUi();
    return;
  }
  if (payload.phase === 'downloaded') {
    settingsUpdateState.downloading = false;
    settingsUpdateState.readyToInstall = true;
    settingsUpdateState.latestVersion = payload.latestVersion || settingsUpdateState.latestVersion;
    renderSettingsUpdateUi();
    return;
  }
  if (payload.phase === 'error') {
    settingsUpdateState.downloading = false;
    settingsUpdateState.checking = false;
    settingsUpdateState.error = true;
    settingsUpdateState.message = payload.message || t('Update failed.');
    renderSettingsUpdateUi();
  }
}

function bindSettingsPanel() {
  elements.settingsNavItems.forEach((button) => {
    button.addEventListener('click', () => {
      switchSettingsPanel(button.dataset.settingsPanel);
    });
  });

  if (elements.btnPickDownloadFolder) {
    elements.btnPickDownloadFolder.addEventListener('click', async () => {
      try {
        const info = await runAction((api) => api.pickDownloadFolder(), {
          label: t('Choose folder'),
          describe: (result) => result?.path || t('Cancelled'),
        });
        if (info) {
          renderSettingsDownloadFolder(info);
        }
      } catch {
        void 0;
      }
    });
  }

  if (elements.btnResetDownloadFolder) {
    elements.btnResetDownloadFolder.addEventListener('click', async () => {
      try {
        const info = await runAction((api) => api.setDownloadFolder(null), {
          label: t('Use system default'),
          describe: (result) => result?.path || '',
        });
        renderSettingsDownloadFolder(info);
      } catch {
        void 0;
      }
    });
  }

  elements.permissionToggles.forEach((input) => {
    input.addEventListener('change', async () => {
      const type = input.dataset.permission;
      const enabled = input.checked;
      try {
        const snapshot = await runAction((api) => api.setPermission(type, enabled), {
          label: t('Permissions'),
          describe: () => `${type}: ${enabled ? t('Enabled') : t('Disabled')}`,
        });
        renderSettingsPermissions(snapshot);
      } catch {
        input.checked = !enabled;
      }
    });
  });

  if (elements.btnCheckUpdates) {
    elements.btnCheckUpdates.addEventListener('click', () => {
      checkSettingsUpdates();
    });
  }
  if (elements.btnDownloadUpdate) {
    elements.btnDownloadUpdate.addEventListener('click', () => {
      downloadSettingsUpdate();
    });
  }
  if (elements.btnInstallUpdate) {
    elements.btnInstallUpdate.addEventListener('click', () => {
      runAction((api) => api.installUpdate(), {
        label: t('Restart and install'),
        describe: () => t('Restarting...'),
      });
    });
  }
  if (elements.btnFactoryReset) {
    elements.btnFactoryReset.addEventListener('click', async () => {
      try {
        const result = await runAction((api) => api.factoryReset(), {
          label: t('Erase all data'),
          describe: (value) => (value?.cancelled ? t('Cancelled') : t('Factory reset')),
        });
        if (result?.cancelled) {
          return;
        }
      } catch {
        void 0;
      }
    });
  }
  if (elements.btnSettingsClose) {
    elements.btnSettingsClose.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeSettingsModal();
    });
  }
  if (elements.settingsModalBackdrop) {
    elements.settingsModalBackdrop.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeSettingsModal();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && settingsModalOpen) {
      event.preventDefault();
      closeSettingsModal();
    }
  });
}

function applySettingsModalVisibility(isOpen) {
  settingsModalOpen = Boolean(isOpen);
  if (elements.settingsModal) {
    elements.settingsModal.classList.toggle('hidden', !settingsModalOpen);
    elements.settingsModal.setAttribute('aria-hidden', String(!settingsModalOpen));
  }
  if (elements.settingsModalBackdrop) {
    elements.settingsModalBackdrop.classList.toggle('hidden', !settingsModalOpen);
    elements.settingsModalBackdrop.setAttribute('aria-hidden', String(!settingsModalOpen));
  }
  if (!isMenuOverlay) {
    void getApi().setSettingsOpen(settingsModalOpen);
  }
}

function openSettingsModal() {
  closeMenu();
  switchSettingsPanel('personalization');
  applySettingsModalVisibility(true);
  renderSettingsUpdateUi();
  if (!settingsAboutInfo) {
    void loadSettingsPanel();
  } else {
    void loadDownloadFolderSettings();
    if (currentState?.panelData?.logs) {
      renderSettingsLogsPreview(currentState.panelData.logs);
    }
  }
}

function closeSettingsModal() {
  applySettingsModalVisibility(false);
}

function renderPanelContent(state) {
  const data = state.panelData || {};
  renderHomeInstances(data.instances);
  renderLogs(data.logs);
  renderHistory(data.pageHistory);
  renderDownloads(data.downloads);
}

function bindHomeInstanceForm() {
  if (!elements.homeInstanceForm) {
    return;
  }
  elements.homeInstanceForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const label = elements.homeInstanceLabel?.value.trim() || '';
    const url = elements.homeInstanceUrl?.value.trim() || '';
    if (!url) {
      window.alert(t('Enter the Odoo instance URL.'));
      return;
    }
    try {
      await runAction((api) => api.addInstance(label, url), {
        label: t('Add Odoo instance'),
        describe: (snapshot) => `${snapshot.items.length} instancias, predeterminada=${snapshot.defaultBaseUrl}`,
      });
      elements.homeInstanceForm.reset();
    } catch {
      void 0;
    }
  });
}

function showPanel(type) {
  Object.entries(panels).forEach(([panelType, panel]) => {
    panel.classList.toggle('hidden', panelType !== type);
  });
  elements.shellContent.classList.remove('hidden');
}

function hidePanels() {
  elements.shellContent.classList.add('hidden');
  Object.values(panels).forEach((panel) => panel.classList.add('hidden'));
}

function renderKeymap(keymap) {
  if (!elements.keymapList) {
    return;
  }
  elements.keymapList.innerHTML = '';
  (keymap || []).forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'keymap-item';
    item.innerHTML = `
      <span class="keymap-label">${entry.label}</span>
      <kbd class="keymap-keys">${entry.display}</kbd>
    `;
    elements.keymapList.appendChild(item);
  });
  requestMenuDrawerScrollbarRefresh();
}

function applyChromeLayout(state) {
  const chromeHeight = state.chromeHeight || 48;
  document.documentElement.style.setProperty('--chrome-height', `${chromeHeight}px`);
  elements.findBar.classList.toggle('hidden', !state.findBarVisible);
  renderPrintNotices(state.printNotices);
}

function getPrintNoticeTitle(notice) {
  if (notice.phase === 'completed') {
    return notice.source === 'remote' ? t('Remote print completed') : t('Local print completed');
  }
  if (notice.phase === 'failed') {
    return notice.source === 'remote' ? t('Remote print failed') : t('Print failed');
  }
  return notice.source === 'remote'
    ? t('Receiving remote print job')
    : t('Sending document to printer');
}

function getPrintNoticeDetail(notice) {
  const documentLabel = notice.reportName || notice.documentName || t('Document');
  const printerLabel = notice.printerName || notice.printerUid || t('Printer');
  return t('%(document)s → %(printer)s', {
    document: documentLabel,
    printer: printerLabel,
  });
}

function renderPrintNotices(notices) {
  if (!elements.printBanner || !elements.printNotices || isMenuOverlay) {
    return;
  }
  const list = Array.isArray(notices) ? notices : [];
  if (!list.length) {
    elements.printBanner.classList.add('hidden');
    elements.printNotices.innerHTML = '';
    return;
  }
  elements.printBanner.classList.remove('hidden');
  elements.printNotices.innerHTML = '';
  list.forEach((notice) => {
    const item = document.createElement('div');
    item.className = `print-notice is-${notice.phase}`;

    const icon = document.createElement('span');
    icon.className = 'print-notice-icon';
    if (notice.phase === 'sending') {
      icon.classList.add('is-loading');
      icon.setAttribute('aria-hidden', 'true');
    } else if (notice.phase === 'completed') {
      icon.textContent = '✓';
    } else {
      icon.textContent = '!';
    }

    const body = document.createElement('div');
    body.className = 'print-notice-body';
    const title = document.createElement('div');
    title.className = 'print-notice-title';
    title.textContent = getPrintNoticeTitle(notice);
    const detail = document.createElement('div');
    detail.className = 'print-notice-detail';
    detail.textContent = notice.error || getPrintNoticeDetail(notice);
    body.appendChild(title);
    body.appendChild(detail);

    item.appendChild(icon);
    item.appendChild(body);

    if (notice.phase !== 'sending') {
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'print-notice-dismiss';
      dismiss.title = t('Close');
      dismiss.textContent = '×';
      dismiss.addEventListener('click', () => {
        getApi().dismissPrintNotice(notice.id);
      });
      item.appendChild(dismiss);
    }

    elements.printNotices.appendChild(item);
  });
}

function applyOverlayState(state) {
  currentState = state;
  syncI18nFromState(state);
  elements.body.classList.remove('platform-darwin', 'platform-win32', 'platform-linux');
  if (state.platform) {
    elements.body.classList.add(`platform-${state.platform}`);
  }
  updateModeSwitches(state.mode);
  elements.btnZoomReset.textContent = zoomToPercent(state.zoomLevel);
  applyPanelZoom(state.zoomLevel, state.isOdooTabActive);
  renderKeymap(state.keymap);
  applyMenuVisibility(state.menuOpen);
  if (state.menuOpen) {
    closeSettingsModal();
  }
}

function applyState(state) {
  currentState = state;
  syncI18nFromState(state);
  if (isMenuOverlay) {
    applyOverlayState(state);
    return;
  }
  const { capabilities } = state;

  elements.body.classList.toggle('kiosk', state.mode === 'kiosk');
  elements.body.classList.toggle('developer', state.mode === 'developer');
  elements.body.classList.toggle('panel-active', !state.isOdooTabActive);
  elements.body.classList.remove('platform-darwin', 'platform-win32', 'platform-linux');
  if (state.platform) {
    elements.body.classList.add(`platform-${state.platform}`);
  }

  applyChromeLayout(state);

  const odooActive = state.isOdooTabActive;
  elements.btnBack.disabled = !odooActive || !state.canGoBack;
  elements.btnForward.disabled = !odooActive || !state.canGoForward;
  elements.btnReload.disabled = !odooActive;
  elements.findBar.classList.toggle('hidden', !state.findBarVisible || !odooActive);

  elements.urlInput.classList.toggle('hidden', !capabilities.canEditUrl || !odooActive);
  elements.urlDisplay.classList.toggle('hidden', capabilities.canEditUrl || !odooActive);
  if (capabilities.canEditUrl && odooActive) {
    if (document.activeElement !== elements.urlInput) {
      elements.urlInput.value = state.currentUrl;
    }
  } else if (odooActive) {
    elements.urlDisplay.textContent = state.currentUrl;
  } else {
    elements.urlDisplay.textContent = '';
    elements.urlDisplay.classList.remove('hidden');
    elements.urlInput.classList.add('hidden');
  }

  updateModeSwitches(state.mode);

  elements.tabsBar.classList.toggle('hidden', !capabilities.canHaveTabs);

  const menuOpen = Boolean(state.menuOpen);
  elements.menuPanel.classList.add('hidden');
  elements.menuBackdrop.classList.add('hidden');
  elements.menuPanel.setAttribute('aria-hidden', 'true');
  if (elements.btnMenu) {
    elements.btnMenu.classList.toggle('active', menuOpen);
  }

  if (capabilities.canHaveTabs && !dragSession.active) {
    renderTabs(state.tabs);
    requestAnimationFrame(updateTabLayout);
  }

  if (odooActive) {
    hidePanels();
  } else {
    showPanel(state.activeTabType);
    renderPanelContent(state);
  }

  elements.btnZoomReset.textContent = zoomToPercent(state.zoomLevel);
  applyPanelZoom(state.zoomLevel, state.isOdooTabActive);
  renderKeymap(state.keymap);

  if (state.findResult) {
    updateFindStatus(state.findResult);
  }

  if (settingsModalOpen) {
    renderSettingsLogsPreview(state.panelData?.logs);
    renderSettingsPermissions(state.permissions);
  }
}

function parseDragPayload(event) {
  const raw = event.dataTransfer.getData(DRAG_MIME);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getTabElements() {
  return Array.from(elements.tabsList.querySelectorAll('.tab-item'));
}

function getInsertIndexFromPointer(clientX) {
  const items = getTabElements();
  if (!items.length) {
    return 0;
  }
  for (let index = 0; index < items.length; index += 1) {
    const rect = items[index].getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    if (clientX < midpoint) {
      return index;
    }
  }
  return items.length;
}

function clearDropIndicator() {
  getTabElements().forEach((item) => item.classList.remove('drop-before', 'drop-after'));
}

function showDropIndicator(clientX) {
  const items = getTabElements();
  clearDropIndicator();
  if (!items.length) {
    return;
  }
  const insertIndex = getInsertIndexFromPointer(clientX);
  if (insertIndex >= items.length) {
    items[items.length - 1].classList.add('drop-after');
    return;
  }
  items[insertIndex].classList.add('drop-before');
}

function isPointerInsideTabsBar(clientX, clientY) {
  const rect = elements.titlebar.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function showTabContextMenu(event, tab) {
  event.preventDefault();
  event.stopPropagation();
  if (!currentState?.capabilities?.canHaveTabs) {
    return;
  }
  getApi().showTabContextMenu({
    tabId: tab.id,
    x: event.screenX,
    y: event.screenY,
    closable: tab.closable !== false,
  });
}

function bindTabDrag(item, tab) {
  item.draggable = true;

  item.addEventListener('dragstart', (event) => {
    if (!currentState?.capabilities?.canHaveTabs) {
      event.preventDefault();
      return;
    }
    const payload = {
      windowId: currentState.windowId,
      tabId: tab.id,
    };
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', tab.title || 'tab');
    event.dataTransfer.effectAllowed = 'move';
    item.classList.add('dragging');
    elements.titlebar.classList.add('drag-active');
    elements.tabsBar.classList.add('drag-active');
    dragSession = {
      active: true,
      tabId: tab.id,
      windowId: currentState.windowId,
      dropped: false,
    };
  });

  item.addEventListener('dragend', async (event) => {
    item.classList.remove('dragging');
    elements.titlebar.classList.remove('drag-active', 'drop-target-window');
    elements.tabsBar.classList.remove('drag-active', 'drop-target-window');
    clearDropIndicator();

    const shouldDetach = dragSession.active
      && !dragSession.dropped
      && dragSession.windowId === currentState?.windowId
      && !isPointerInsideTabsBar(event.clientX, event.clientY);

    const session = { ...dragSession };
    dragSession = { active: false, tabId: null, windowId: null, dropped: false };

    if (shouldDetach) {
      await runAction((api) => api.detachTab(session.tabId, {
        screenX: event.screenX,
        screenY: event.screenY,
      }), {
        label: `Desacoplar pestaña: ${session.tabId}`,
        describe: describeBrowserState,
      });
    } else {
      getApi().getState().then(applyState).catch(() => {});
    }
  });
}

function setupTabsDropZone() {
  const handleDragOver = (event) => {
    if (!currentState?.capabilities?.canHaveTabs) {
      return;
    }
    if (!event.dataTransfer.types.includes(DRAG_MIME)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    elements.titlebar.classList.add('drag-active');
    elements.tabsBar.classList.add('drag-active');
    const payload = parseDragPayload(event);
    if (payload && payload.windowId !== currentState.windowId) {
      elements.titlebar.classList.add('drop-target-window');
      clearDropIndicator();
    } else {
      elements.titlebar.classList.remove('drop-target-window');
      showDropIndicator(event.clientX);
    }
  };

  const handleDragLeave = (event) => {
    if (!elements.titlebar.contains(event.relatedTarget)) {
      elements.titlebar.classList.remove('drop-target-window');
      clearDropIndicator();
    }
  };

  const handleDrop = async (event) => {
    if (!currentState?.capabilities?.canHaveTabs) {
      return;
    }
    event.preventDefault();
    const payload = parseDragPayload(event);
    if (!payload?.tabId || !payload?.windowId) {
      return;
    }

    dragSession.dropped = true;
    elements.titlebar.classList.remove('drag-active', 'drop-target-window');
    elements.tabsBar.classList.remove('drag-active', 'drop-target-window');
    clearDropIndicator();

    const insertIndex = getInsertIndexFromPointer(event.clientX);

    if (payload.windowId !== currentState.windowId) {
      await runAction((api) => api.mergeWindow(payload.windowId, insertIndex), {
        label: `Fusionar ventana: ${payload.windowId}`,
        describe: describeBrowserState,
      });
      return;
    }

    await runAction((api) => api.reorderTab(payload.tabId, insertIndex), {
      label: `Reordenar pestaña: ${payload.tabId}`,
      describe: describeBrowserState,
    });
  };

  elements.titlebar.addEventListener('dragover', handleDragOver);
  elements.titlebar.addEventListener('dragleave', handleDragLeave);
  elements.titlebar.addEventListener('drop', handleDrop);
}

function updateTabLayout() {
  if (!currentState?.capabilities?.canHaveTabs || elements.tabsBar.classList.contains('hidden')) {
    return;
  }

  const tabs = getTabElements();
  if (!tabs.length) {
    return;
  }

  const titlebarWidth = elements.titlebar.getBoundingClientRect().width;
  const dragReserved = Math.max(40, elements.titlebarDrag.getBoundingClientRect().width);
  const addBtnWidth = elements.btnNewTab.getBoundingClientRect().width || 28;
  const tabGap = 4;
  const chromePadding = 10;
  const maxStripWidth = Math.max(0, titlebarWidth - dragReserved - chromePadding);
  const available = Math.max(0, maxStripWidth - addBtnWidth - tabGap);
  const gaps = Math.max(0, tabs.length - 1) * tabGap;

  const maxTabWidth = 200;
  const minTabWidth = 44;
  const compactThreshold = 72;

  let tabWidth = Math.floor((available - gaps) / tabs.length);
  tabWidth = Math.min(maxTabWidth, Math.max(minTabWidth, tabWidth));

  document.documentElement.style.setProperty('--tab-width', `${tabWidth}px`);
  tabs.forEach((tab) => {
    tab.classList.toggle('tab-compact', tabWidth < compactThreshold);
    tab.classList.toggle('tab-minimal', tabWidth <= minTabWidth + 4);
  });
}

function renderTabs(tabs) {
  elements.tabsList.innerHTML = '';
  tabs.forEach((tab) => {
    const item = document.createElement('div');
    item.className = `tab-item${tab.active ? ' active' : ''}${tab.type !== TAB_TYPES.ODOO ? ' tab-panel' : ''}`;
    item.dataset.tabId = tab.id;

    if (tab.type === TAB_TYPES.ODOO && tab.isLoading) {
      const spinner = document.createElement('span');
      spinner.className = 'tab-loading-spinner';
      spinner.title = t('Loading');
      spinner.setAttribute('aria-label', t('Loading'));
      item.appendChild(spinner);
    }

    if (tab.type === TAB_TYPES.ODOO && tab.kioskCompatible) {
      const led = document.createElement('span');
      led.className = 'tab-compat-led';
      led.title = t('PBA Kiosk compatible');
      led.setAttribute('aria-label', t('PBA Kiosk compatible'));
      item.appendChild(led);
    }

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || tab.url || t('Tab');
    item.appendChild(title);

    if (tab.closable) {
      const close = document.createElement('button');
      close.className = 'tab-close';
      close.title = 'Cerrar pestaña';
      close.textContent = '×';
      close.addEventListener('mousedown', (event) => event.stopPropagation());
      close.addEventListener('click', (event) => {
        event.stopPropagation();
        runAction((api) => api.closeTab(tab.id), {
          label: `Cerrar pestaña: ${tab.title || tab.id}`,
          describe: describeBrowserState,
        });
      });
      item.appendChild(close);
    }

    item.addEventListener('click', () => {
      runAction((api) => api.switchTab(tab.id), {
        label: `Pestaña: ${tab.title || tab.id}`,
        describe: describeBrowserState,
      });
    });
    bindTabDrag(item, tab);
    item.addEventListener('contextmenu', (event) => {
      showTabContextMenu(event, tab);
    });
    elements.tabsList.appendChild(item);
  });
  updateTabLayout();
}

async function setMode(mode) {
  let pin;
  if (mode === 'developer') {
    pin = window.prompt('PIN de desarrollador (dejar vacío si no está configurado):') || undefined;
  }
  await runAction((api) => api.setMode(mode, pin), {
    label: `${t('Mode changed')}: ${getModeLabel(mode)}`,
    describe: (caps) => `${t('Mode changed')}=${getModeLabel(caps.mode)}`,
  });
}

function isFindBarOpen() {
  return !elements.findBar.classList.contains('hidden');
}

function focusFindInput() {
  requestAnimationFrame(() => {
    elements.findInput.focus();
    elements.findInput.select();
  });
}

function showFindBar() {
  if (!currentState?.isOdooTabActive) {
    getApi().appendLog({
      level: 'warn',
      source: 'click',
      message: 'Buscar en página',
      detail: 'sin efecto (no hay pestaña Odoo activa)',
    });
    return;
  }
  elements.findBar.classList.remove('hidden');
  runAction((api) => api.setFindBarVisible(true), {
    label: 'Abrir buscar en página',
    describe: () => 'barra de búsqueda visible',
  }).then(() => {
    focusFindInput();
  });
}

function toggleFindBar() {
  if (isFindBarOpen()) {
    hideFindBar();
    return;
  }
  showFindBar();
}

function updateFindStatus(result) {
  if (!result || !result.query) {
    elements.findStatus.textContent = '';
    elements.findStatus.classList.remove('has-matches', 'no-matches');
    return;
  }
  elements.findStatus.textContent = result.label || '';
  elements.findStatus.classList.toggle('has-matches', result.matches > 0);
  elements.findStatus.classList.toggle('no-matches', result.matches === 0);
  const canNavigate = result.matches > 1;
  elements.btnFindPrev.disabled = !canNavigate;
  elements.btnFindNext.disabled = !canNavigate;
}

function performFind(forward = true, followUp = false) {
  const text = elements.findInput.value.trim();
  if (!text) {
    runAction((api) => api.stopFind('clearSelection'), {
      label: 'Limpiar búsqueda',
      describe: () => 'búsqueda limpiada',
    });
    lastFindQuery = '';
    updateFindStatus({ query: '', matches: 0, activeMatchOrdinal: 0, label: '' });
    return;
  }
  const isFollowUp = followUp && text === lastFindQuery;
  if (!isFollowUp) {
    lastFindQuery = text;
  }
  const direction = forward ? 'siguiente' : 'anterior';
  runAction((api) => api.findInPage(text, { forward, followUp: isFollowUp }), {
    label: followUp ? `Buscar ${direction}: ${text}` : `Buscar: ${text}`,
    describe: (result) => result?.label || 'búsqueda enviada',
  });
}

function hideFindBar() {
  elements.findBar.classList.add('hidden');
  lastFindQuery = '';
  updateFindStatus({ query: '', matches: 0, activeMatchOrdinal: 0, label: '' });
  runAction((api) => {
    api.setFindBarVisible(false);
    return api.stopFind('clearSelection');
  }, {
    label: 'Cerrar buscar en página',
    describe: () => 'barra de búsqueda oculta',
  });
}

async function copyLogs() {
  const logs = currentState?.panelData?.logs || [];
  const text = logs.map(formatLogEntry).join('\n');
  await runAction(async () => {
    await navigator.clipboard.writeText(text);
    return `${logs.length} líneas copiadas`;
  }, {
    label: getMenuActionLabel('copy-logs'),
    describe: (result) => String(result),
  });
  window.alert(t('Logs copied to clipboard'));
}

const MENU_ACTION_KEYS = {
  find: 'Find in page',
  devtools: 'Developer tools',
  'new-tab': 'New Odoo tab',
  'open-logs': 'View logs',
  'open-history': 'Page history',
  'open-downloads': 'Download history',
  'open-settings': 'Settings',
  'copy-logs': 'Copy logs',
  'export-logs': 'Export logs to file',
  'clear-logs': 'Clear logs',
};

function getMenuActionLabel(action) {
  const key = MENU_ACTION_KEYS[action];
  return key ? `${t('Menu')}: ${t(key)}` : `${t('Menu')}: ${action}`;
}

async function handleMenuAction(action, options = {}) {
  const label = getMenuActionLabel(action);

  if (!options.keepMenuOpen) {
    closeMenu();
  }

  if (action !== 'open-settings') {
    closeSettingsModal();
  }

  switch (action) {
    case 'find':
      toggleFindBar();
      break;
    case 'devtools':
      await runAction((api) => api.toggleDevTools(), {
        label,
        describe: (opened) => (opened ? 'devtools abiertas' : 'devtools cerradas'),
      });
      break;
    case 'new-tab':
      await runAction((api) => api.newTab(), { label, describe: describeBrowserState });
      break;
    case 'open-logs':
      await runAction((api) => api.openTab(TAB_TYPES.LOGS), { label, describe: describeBrowserState });
      break;
    case 'open-history':
      await runAction((api) => api.openTab(TAB_TYPES.HISTORY), { label, describe: describeBrowserState });
      break;
    case 'open-downloads':
      await runAction((api) => api.openTab(TAB_TYPES.DOWNLOADS), { label, describe: describeBrowserState });
      break;
    case 'open-settings':
      if (isMenuOverlay) {
        closeMenu();
        await getApi().sendShellAction('openSettings');
      } else {
        openSettingsModal();
      }
      break;
    case 'copy-logs':
      await copyLogs();
      break;
    case 'export-logs': {
      const filePath = await runAction((api) => api.exportLogs(), {
        label,
        describe: (path) => `exportado en ${path}`,
      });
      window.alert(t('Logs exported to:\n%(path)s', { path: filePath }));
      break;
    }
    case 'clear-logs':
      await runAction((api) => api.clearLogs(), {
        label,
        describe: () => t('Logs cleared'),
      });
      break;
    default:
      await getApi().appendLog({
        level: 'warn',
        source: 'click',
        message: label,
        detail: 'acción no reconocida',
      });
      break;
  }
}

if (!isMenuOverlay) {
  elements.btnBack.addEventListener('click', () => {
    runAction((api) => api.goBack(), {
      label: 'Atrás',
      target: elements.btnBack,
      describe: describeBrowserState,
    });
  });
  elements.btnForward.addEventListener('click', () => {
    runAction((api) => api.goForward(), {
      label: 'Adelante',
      target: elements.btnForward,
      describe: describeBrowserState,
    });
  });
  elements.btnReload.addEventListener('click', (event) => {
    runAction((api) => api.reload({ ignoreCache: event.shiftKey }), {
      label: event.shiftKey ? 'Recargar sin caché' : 'Recargar',
      describe: describeBrowserState,
    });
  });
  elements.btnHome.addEventListener('click', () => {
    runAction((api) => api.home(), {
      label: 'Inicio',
      describe: describeBrowserState,
    });
  });
  elements.btnNewTab.addEventListener('click', () => {
    runAction((api) => api.newTab(), {
      label: 'Nueva pestaña',
      describe: describeBrowserState,
    });
  });

  elements.urlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const value = elements.urlInput.value.trim();
      if (value) {
        const url = value.includes('://') ? value : `https://${value}`;
        runAction((api) => api.navigate(url), {
          label: 'Navegar URL',
          describe: describeBrowserState,
        });
      }
    }
  });
}

if (!isMenuOverlay && elements.btnMenu) {
  elements.btnMenu.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleMenu();
  });
}

function bindZoomControl(button, action, label) {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    runAction(action, {
      label,
      describe: (level) => `zoom=${zoomToPercent(level)}`,
    });
  });
}

if (!isMenuOverlay) {
  elements.btnFindClose.addEventListener('click', hideFindBar);
  elements.btnFindNext.addEventListener('click', () => performFind(true, true));
  elements.btnFindPrev.addEventListener('click', () => performFind(false, true));
  elements.findInput.addEventListener('input', () => {
    clearTimeout(findInputTimer);
    findInputTimer = setTimeout(() => performFind(true, false), 80);
  });
  elements.findInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      performFind(!event.shiftKey, true);
    }
    if (event.key === 'Escape') {
      hideFindBar();
    }
  });

  window.addEventListener('resize', () => {
    requestAnimationFrame(updateTabLayout);
  });
}

window.addEventListener('error', (event) => {
  if (window.shellAPI) {
    window.shellAPI.appendLog({
      level: 'error',
      source: 'shell',
      message: event.message,
      detail: `${event.filename}:${event.lineno}`,
    });
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (window.shellAPI) {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    window.shellAPI.appendLog({ level: 'error', source: 'shell', message: reason });
  }
});

function bindMenuGroupToggles() {
  document.querySelectorAll('.menu-group-toggle').forEach((toggle) => {
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const group = toggle.closest('.menu-group');
      const body = group?.querySelector('.menu-group-body');
      if (!body) {
        return;
      }
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isOpen));
      group.classList.toggle('is-open', !isOpen);
      body.hidden = isOpen;
      requestMenuDrawerScrollbarRefresh();
    });
  });
}

function bindMenuHandlers() {
  bindMenuGroupToggles();

  elements.modeItems.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.classList.contains('active')) {
        return;
      }
      closeMenu();
      setMode(button.dataset.mode);
    });
  });

  if (elements.languageSelect) {
    elements.languageSelect.addEventListener('change', async () => {
      const locale = elements.languageSelect.value;
      await runAction((api) => api.setLocale(locale), {
        label: t('Language'),
        describe: (value) => value,
      });
    });
  }

  elements.menuItems.forEach((button) => {
    button.addEventListener('click', () => handleMenuAction(button.dataset.action));
  });

  bindZoomControl(elements.btnZoomIn, (api) => api.setZoom(0.5), 'Zoom +');
  bindZoomControl(elements.btnZoomOut, (api) => api.setZoom(-0.5), 'Zoom −');
  bindZoomControl(elements.btnZoomReset, (api) => api.resetZoom(), 'Restablecer zoom');

  if (elements.btnMenuClose) {
    let menuCloseLock = false;
    const handleMenuClose = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (menuCloseLock) {
        return;
      }
      menuCloseLock = true;
      closeMenu();
      window.setTimeout(() => {
        menuCloseLock = false;
      }, 250);
    };
    elements.btnMenuClose.addEventListener('pointerdown', handleMenuClose);
    elements.btnMenuClose.addEventListener('click', handleMenuClose);
  }
  if (elements.menuBackdrop) {
    elements.menuBackdrop.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
    });
  }
}

function boot() {
  try {
    const api = getApi();

    setupMenuDrawerScrollbar();
    bindHistoryPanel();
    bindMenuHandlers();

    if (isMenuOverlay) {
      api.onStateUpdate(applyState);
      api.getState().then(applyState).catch((error) => {
        elements.bootError.textContent = error.message;
        elements.bootError.classList.remove('hidden');
      });
      return;
    }

    setupTabsDropZone();
    bindHomeInstanceForm();
    bindSettingsPanel();
    api.onStateUpdate(applyState);
    api.onFindResult(updateFindStatus);
    api.onUpdateEvent(handleSettingsUpdateEvent);

    api.onAction((payload) => {
      if (payload?.action === 'toggleFind' || payload?.action === 'focusFind') {
        toggleFindBar();
      }
      if (payload?.action === 'setMode:kiosk') {
        setMode('kiosk');
      }
      if (payload?.action === 'setMode:free') {
        setMode('free');
      }
      if (payload?.action === 'openLogs') {
        handleMenuAction('open-logs');
      }
      if (payload?.action === 'open-downloads') {
        handleMenuAction('open-downloads');
      }
      if (payload?.action === 'exportLogs') {
        handleMenuAction('export-logs');
      }
      if (payload?.action === 'copyLogs') {
        handleMenuAction('copy-logs');
      }
      if (payload?.action === 'clearLogs') {
        handleMenuAction('clear-logs');
      }
      if (payload?.action === 'openSettings') {
        openSettingsModal();
      }
    });

    api.onLogEntry((entry) => {
      if (currentState?.activeTabType === TAB_TYPES.LOGS && currentState.panelData) {
        currentState.panelData.logs = [...(currentState.panelData.logs || []), entry];
        renderLogs(currentState.panelData.logs);
      }
      if (settingsModalOpen && currentState?.panelData) {
        currentState.panelData.logs = [...(currentState.panelData.logs || []), entry];
        renderSettingsLogsPreview(currentState.panelData.logs);
      }
    });

    api.getState().then(applyState).then(() => prefetchSettingsAbout()).catch((error) => {
      elements.bootError.textContent = error.message;
      elements.bootError.classList.remove('hidden');
    });
  } catch (error) {
    elements.bootError.textContent = error.message;
    elements.bootError.classList.remove('hidden');
  }
}

boot();
