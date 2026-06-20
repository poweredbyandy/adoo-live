const fs = require('fs');
const path = require('path');
const { initI18n, getCatalog } = require('../../src/i18n');
const { getModeCapabilities } = require('../../src/main/mode-manager');
const { TAB_TYPES } = require('../../src/shared/tab-types');

const RENDERER_DIR = path.join(__dirname, '../../src/renderer');
const SHELL_HTML_PATH = path.join(RENDERER_DIR, 'shell.html');
const SHELL_STYLE_FILES = [
  'ui/tokens.css',
  'ui/base.css',
  'ui/components.css',
  'ui/shell-chrome.css',
];

function buildShellHtmlForDom() {
  let html = fs.readFileSync(SHELL_HTML_PATH, 'utf8');
  html = html.replace(/<link\b[^>]*>/gi, '');
  html = html.replace(/<script\b[^>]*src=[^>]*>\s*<\/script>/gi, '');
  const inlineStyles = SHELL_STYLE_FILES.map((relativePath) => {
    const css = fs.readFileSync(path.join(RENDERER_DIR, relativePath), 'utf8');
    return `<style data-shell-test-css="${relativePath}">${css}</style>`;
  }).join('\n');
  html = html.replace('</head>', `${inlineStyles}\n</head>`);
  return html;
}

function normalizeTabsForState(tabs, activeTabId, canHaveTabs) {
  return tabs.map((tab) => ({
    ...tab,
    active: tab.id === activeTabId,
    closable: canHaveTabs,
    kioskCompatible: tab.kioskCompatible ?? false,
    isLoading: tab.isLoading ?? false,
  }));
}

function buildShellState(overrides = {}) {
  const mode = overrides.mode || 'free';
  const capabilities = overrides.capabilities || getModeCapabilities(mode);
  const activeTabType = overrides.activeTabType || TAB_TYPES.HOME;
  const activeTabId = overrides.activeTabId || 'tab-home';
  initI18n(overrides.locale || 'en');
  const catalog = overrides.i18nCatalog || getCatalog();

  const base = {
    windowId: 1,
    platform: overrides.platform || 'darwin',
    mode,
    capabilities,
    tabs: normalizeTabsForState(
      overrides.tabs || [{
        id: activeTabId,
        type: activeTabType,
        title: activeTabType === TAB_TYPES.HOME ? 'Start' : activeTabType,
        url: overrides.currentUrl || '',
      }],
      activeTabId,
      capabilities.canHaveTabs,
    ),
    activeTabId,
    activeTabType,
    isOdooTabActive: activeTabType === TAB_TYPES.ODOO,
    canGoBack: overrides.canGoBack ?? false,
    canGoForward: overrides.canGoForward ?? false,
    isLoading: false,
    currentUrl: overrides.currentUrl || '',
    zoomLevel: overrides.zoomLevel ?? 0,
    findBarVisible: overrides.findBarVisible ?? false,
    menuOpen: overrides.menuOpen ?? false,
    findResult: overrides.findResult ?? null,
    chromeHeight: overrides.chromeHeight ?? 98,
    printNotices: overrides.printNotices || [],
    panelData: {
      logs: overrides.logs || [],
      instances: overrides.instances || { items: [], defaultInstanceId: null },
      pageHistory: overrides.pageHistory || [],
      downloads: overrides.downloads || [],
    },
    locale: overrides.locale || 'en',
    i18nCatalog: catalog,
    keymap: overrides.keymap || [{ label: 'Reload', display: 'Ctrl+R' }],
    permissions: overrides.permissions || {
      printers: { enabled: true, status: 'granted' },
      devices: { enabled: true, status: 'granted' },
      camera: { enabled: true, status: 'granted' },
      files: { enabled: true, status: 'granted' },
    },
  };

  return { ...base, ...overrides, panelData: { ...base.panelData, ...(overrides.panelData || {}) } };
}

function createMockShellAPI(initialState) {
  const calls = [];
  let state = structuredClone(initialState);
  const stateListeners = [];

  function record(method, args, result) {
    calls.push({ method, args, result });
    return result;
  }

  function broadcast() {
    stateListeners.forEach((listener) => listener(state));
  }

  const api = {
    calls,
    getState: () => Promise.resolve(state),
    setState: (nextState) => {
      state = structuredClone(nextState);
      broadcast();
    },
    patchState: (patch) => {
      state = { ...state, ...patch };
      broadcast();
    },
    appendLog: (entry) => record('appendLog', [entry], true),
    goBack: () => record('goBack', [], state),
    goForward: () => record('goForward', [], state),
    reload: (options) => record('reload', [options], state),
    stop: () => record('stop', [], state),
    home: () => {
      state.activeTabType = TAB_TYPES.HOME;
      state.isOdooTabActive = false;
      broadcast();
      return record('home', [], state);
    },
    newTab: (url) => {
      const tab = {
        id: `tab-odoo-${state.tabs.length + 1}`,
        type: TAB_TYPES.ODOO,
        title: 'Odoo',
        url: url || 'https://odoo.test',
        closable: state.capabilities.canHaveTabs,
        active: true,
        kioskCompatible: false,
        isLoading: false,
      };
      state.tabs = state.tabs.map((item) => ({ ...item, active: false }));
      state.tabs.push(tab);
      state.activeTabId = tab.id;
      state.activeTabType = TAB_TYPES.ODOO;
      state.isOdooTabActive = true;
      state.currentUrl = tab.url;
      broadcast();
      return record('newTab', [url], state);
    },
    openTab: (type) => {
      const existing = state.tabs.find((tab) => tab.type === type);
      if (existing) {
        state.activeTabId = existing.id;
      } else {
        const tab = {
          id: `tab-${type}`,
          type,
          title: type,
          url: '',
          closable: state.capabilities.canHaveTabs,
          active: true,
          kioskCompatible: false,
          isLoading: false,
        };
        state.tabs.push(tab);
        state.activeTabId = tab.id;
      }
      state.tabs = state.tabs.map((tab) => ({
        ...tab,
        active: tab.id === state.activeTabId,
      }));
      state.activeTabType = type;
      state.isOdooTabActive = type === TAB_TYPES.ODOO;
      broadcast();
      return record('openTab', [type], state);
    },
    switchTab: (tabId) => {
      const tab = state.tabs.find((item) => item.id === tabId);
      if (tab) {
        state.activeTabId = tab.id;
        state.activeTabType = tab.type;
        state.isOdooTabActive = tab.type === TAB_TYPES.ODOO;
        state.tabs = state.tabs.map((item) => ({
          ...item,
          active: item.id === tabId,
        }));
        broadcast();
      }
      return record('switchTab', [tabId], state);
    },
    closeTab: (tabId) => {
      state.tabs = state.tabs.filter((tab) => tab.id !== tabId);
      if (state.activeTabId === tabId) {
        const fallback = state.tabs[0];
        state.activeTabId = fallback?.id || null;
        state.activeTabType = fallback?.type || TAB_TYPES.HOME;
        state.isOdooTabActive = fallback?.type === TAB_TYPES.ODOO;
      }
      state.tabs = state.tabs.map((item) => ({
        ...item,
        active: item.id === state.activeTabId,
      }));
      broadcast();
      return record('closeTab', [tabId], state);
    },
    reorderTab: (tabId, newIndex) => record('reorderTab', [tabId, newIndex], state),
    detachTab: (tabId, position) => record('detachTab', [tabId, position], state),
    mergeWindow: (sourceWindowId, insertIndex) => record('mergeWindow', [sourceWindowId, insertIndex], state),
    duplicateTab: (tabId) => record('duplicateTab', [tabId], state),
    attachTab: (...args) => record('attachTab', args, state),
    navigate: (url) => {
      state.currentUrl = url;
      broadcast();
      return record('navigate', [url], state);
    },
    findInPage: (text, options) => record('findInPage', [text, options], { matches: 1, label: '1/1' }),
    stopFind: (action) => record('stopFind', [action], true),
    setZoom: (delta) => {
      state.zoomLevel += delta;
      broadcast();
      return record('setZoom', [delta], state.zoomLevel);
    },
    resetZoom: () => {
      state.zoomLevel = 0;
      broadcast();
      return record('resetZoom', [], state.zoomLevel);
    },
    toggleDevTools: () => record('toggleDevTools', [], true),
    setFindBarVisible: (visible) => {
      state.findBarVisible = visible;
      broadcast();
      return record('setFindBarVisible', [visible], state);
    },
    setMenuOpen: (open) => {
      state.menuOpen = open;
      broadcast();
      return record('setMenuOpen', [open], state);
    },
    setSettingsOpen: (open) => record('setSettingsOpen', [open], open),
    sendShellAction: (action) => record('sendShellAction', [action], true),
    dismissPrintNotice: (id) => {
      state.printNotices = state.printNotices.filter((notice) => notice.id !== id);
      broadcast();
      return record('dismissPrintNotice', [id], state);
    },
    getLogs: () => Promise.resolve(state.panelData.logs),
    clearLogs: () => {
      state.panelData.logs = [];
      broadcast();
      return record('clearLogs', [], true);
    },
    exportLogs: () => record('exportLogs', [], '/tmp/logs.txt'),
    addInstance: (label, url) => {
      const id = `inst-${state.panelData.instances.items.length + 1}`;
      state.panelData.instances.items.push({
        id,
        label,
        host: url,
        baseUrl: url,
      });
      broadcast();
      return record('addInstance', [label, url], state.panelData.instances);
    },
    updateInstance: (id, patch) => {
      state.panelData.instances.items = state.panelData.instances.items.map((item) => (
        item.id === id ? { ...item, ...patch, baseUrl: patch.url || item.baseUrl } : item
      ));
      broadcast();
      return record('updateInstance', [id, patch], state.panelData.instances);
    },
    removeInstance: (id) => {
      state.panelData.instances.items = state.panelData.instances.items.filter((item) => item.id !== id);
      if (state.panelData.instances.defaultInstanceId === id) {
        state.panelData.instances.defaultInstanceId = null;
      }
      broadcast();
      return record('removeInstance', [id], state.panelData.instances);
    },
    setDefaultInstance: (id) => {
      state.panelData.instances.defaultInstanceId = id;
      broadcast();
      return record('setDefaultInstance', [id], state.panelData.instances);
    },
    clearPageHistory: () => {
      state.panelData.pageHistory = [];
      broadcast();
      return record('clearPageHistory', [], true);
    },
    setLocale: (locale) => {
      state.locale = locale;
      broadcast();
      return record('setLocale', [locale], locale);
    },
    getAboutInfo: () => record('getAboutInfo', [], {
      appName: 'adoo IoT',
      version: '1.0.0',
      canAutoUpdate: true,
    }),
    checkForUpdates: () => record('checkForUpdates', [], {
      updateAvailable: false,
      upToDate: true,
      canAutoUpdate: true,
      currentVersion: '1.0.0',
    }),
    downloadUpdate: () => record('downloadUpdate', [], { ok: true }),
    installUpdate: () => record('installUpdate', [], true),
    factoryReset: () => record('factoryReset', [], { cancelled: true }),
    regenerateOdooAssets: () => record('regenerateOdooAssets', [], { cancelled: true }),
    confirm: (options) => record('confirm', [options], { confirmed: true }),
    getDownloadFolder: () => record('getDownloadFolder', [], { path: '/tmp/downloads', isCustom: false }),
    setDownloadFolder: (folderPath) => record('setDownloadFolder', [folderPath], { path: folderPath, isCustom: Boolean(folderPath) }),
    pickDownloadFolder: () => record('pickDownloadFolder', [], { path: '/tmp/custom', isCustom: true }),
    openDownloadFile: (id) => record('openDownloadFile', [id], true),
    openDownloadFolder: (id) => record('openDownloadFolder', [id], true),
    removeDownload: (id, deleteFile) => {
      state.panelData.downloads = state.panelData.downloads.filter((entry) => entry.id !== id);
      broadcast();
      return record('removeDownload', [id, deleteFile], true);
    },
    getPermissions: () => record('getPermissions', [], state.permissions),
    setPermission: (type, enabled) => {
      state.permissions[type] = { ...state.permissions[type], enabled };
      broadcast();
      return record('setPermission', [type, enabled], state.permissions);
    },
    setMode: (mode, pin) => {
      state.mode = mode;
      state.capabilities = getModeCapabilities(mode);
      broadcast();
      return record('setMode', [mode, pin], state.capabilities);
    },
    showTabContextMenu: (payload) => record('showTabContextMenu', [payload], true),
    onStateUpdate: (callback) => {
      stateListeners.push(callback);
      return () => {
        const index = stateListeners.indexOf(callback);
        if (index >= 0) {
          stateListeners.splice(index, 1);
        }
      };
    },
    onAction: () => () => {},
    onLogEntry: () => () => {},
    onFindResult: () => () => {},
    onUpdateEvent: () => () => {},
  };

  return api;
}

function installShellGlobals() {
  window.alert = window.alert || (() => {});
  if (!navigator.clipboard) {
    navigator.clipboard = { writeText: async () => {} };
  }
  if (!window.__shellTestFetchInstalled) {
    const nativeFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
    window.fetch = async (input, init) => {
      const url = String(input);
      if (
        url.includes('localhost')
        || url.endsWith('.css')
        || url.endsWith('.png')
        || url.includes('/ui/')
      ) {
        const contentType = url.endsWith('.css') ? 'text/css' : 'application/octet-stream';
        return new Response('', { status: 200, headers: { 'Content-Type': contentType } });
      }
      if (nativeFetch) {
        return nativeFetch(input, init);
      }
      return new Response('', { status: 200 });
    };
    window.__shellTestFetchInstalled = true;
  }
}

function loadRendererScript(relativePath) {
  const code = fs.readFileSync(path.join(RENDERER_DIR, relativePath), 'utf8');
  // eslint-disable-next-line no-eval
  global.eval(code);
}

async function loadShell(stateOverrides = {}) {
  installShellGlobals();
  const html = buildShellHtmlForDom();
  document.open();
  document.write(html);
  document.close();

  const state = buildShellState(stateOverrides);
  const api = createMockShellAPI(state);
  window.shellAPI = api;

  loadRendererScript('ui/icons.js');
  loadRendererScript('ui/components.js');
  loadRendererScript('i18n.js');
  loadRendererScript('shell.js');

  await flushPromises();
  await flushPromises();

  return { api, state };
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function clickElement(element) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await flushPromises();
}

function countApiCalls(api, method) {
  return api.calls.filter((call) => call.method === method).length;
}

function extractShellHtmlButtonIds(html) {
  const ids = new Set();
  const pattern = /<button\b[^>]*\bid="([^"]+)"/gi;
  let match = pattern.exec(html);
  while (match) {
    ids.add(match[1]);
    match = pattern.exec(html);
  }
  return ids;
}

function extractShellHtmlMenuActions(html) {
  const actions = new Set();
  const pattern = /<button\b[^>]*\bdata-action="([^"]+)"/gi;
  let match = pattern.exec(html);
  while (match) {
    actions.add(match[1]);
    match = pattern.exec(html);
  }
  return actions;
}

function openSettingsModal(document) {
  const settingsButton = document.querySelector('[data-action="open-settings"]');
  if (settingsButton) {
    settingsButton.click();
  }
}

function switchSettingsPanel(document, panel) {
  const nav = document.querySelector(`[data-settings-panel="${panel}"]`);
  if (nav) {
    nav.click();
  }
}

module.exports = {
  buildShellState,
  createMockShellAPI,
  loadShell,
  flushPromises,
  clickElement,
  countApiCalls,
  extractShellHtmlButtonIds,
  extractShellHtmlMenuActions,
  openSettingsModal,
  switchSettingsPanel,
  SHELL_HTML_PATH,
};
