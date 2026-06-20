const fs = require('fs');
const path = require('path');
const { BrowserWindow, WebContentsView } = require('electron');
const { TOOLBAR_HEIGHT, TITLEBAR_HEIGHT } = require('../shared/constants');
const { getBrowserWindowOptions, applyWindowChrome } = require('./window-chrome');
const { TAB_TYPES, PANEL_TITLES, SINGLETON_PANEL_TYPES } = require('../shared/tab-types');
const { IPC } = require('../shared/ipc-channels');
const { calculateContentBounds, canAddTab, isUrlAllowed } = require('../shared/validators');
const { isNavigationRestricted, shouldAutoOpenDevTools } = require('./mode-manager');
const { getOdooSession } = require('./session');
const { canGoBack, canGoForward, goBack, goForward } = require('./navigation');
const { attachWebContentsLogging, appLogger } = require('./logger');
const { buildFindOptions, formatFindStatus } = require('./find-in-page');
const { historyStore } = require('./history-store');
const { getKeymapForDisplay } = require('../shared/keymap');
const { getDefaultBaseUrl, getInstancesSnapshot } = require('./instances');
const { buildOdooDebugReloadUrl } = require('../shared/odoo-debug');
const { attachInputShortcuts } = require('./input-shortcuts');
const { attachContextMenu } = require('./context-menu');
const { checkKioskCompatibilityFromWebContents } = require('./kiosk-compatibility');
const { isNavigableOdooUrl } = require('../shared/kiosk-compatibility');
const { attachKioskDeviceManager, stopKioskDeviceSession } = require('./kiosk-device-service');
const { t, getLocale, getCatalog } = require('../i18n');

const FIND_BAR_HEIGHT = 42;
const PRINT_BANNER_HEIGHT = 40;
const PUSH_SHIM_SOURCE = fs.readFileSync(path.join(__dirname, '../preload/odoo-push-shim.js'), 'utf8');
const NOTIFICATION_SHIM_SOURCE = fs.readFileSync(
  path.join(__dirname, '../preload/odoo-notification-shim.js'),
  'utf8',
);
const { showDownloadNotification } = require('./notification-service');

function injectOdooPageShims(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return;
  }
  webContents.executeJavaScript(NOTIFICATION_SHIM_SOURCE).catch((error) => {
    appLogger.add('error', 'notify', t('Could not install notification shim'), error.message);
  });
  webContents.executeJavaScript(PUSH_SHIM_SOURCE).catch((error) => {
    appLogger.add('error', 'webpush', t('Could not install push shim'), error.message);
  });
}

let tabCounter = 0;
let downloadsConfigured = false;

function createTabId() {
  tabCounter += 1;
  return `tab-${tabCounter}`;
}

function isOdooTab(tab) {
  return tab?.type === TAB_TYPES.ODOO;
}

class WindowManager {
  constructor(config, modeManager, registry = null) {
    this.config = config;
    this.modeManager = modeManager;
    this.registry = registry;
    this.id = null;
    this.window = null;
    this.tabs = [];
    this.activeTabId = null;
    this.pendingTabs = null;
    this.pendingActiveTabId = null;
    this.zoomLevel = 0;
    this.findRequestId = 0;
    this.findBarVisible = false;
    this.menuOpen = false;
    this.menuOverlayView = null;
    this.menuOverlayReady = null;
    this.menuOverlayToken = 0;
    this.printNotices = new Map();
    this.printNoticeTimers = new Map();
    this.currentFindQuery = '';
    this.findResult = { query: '', matches: 0, activeMatchOrdinal: 0, label: '' };
    WindowManager.configureDownloadsOnce();
  }

  static configureDownloadsOnce() {
    if (downloadsConfigured) {
      return;
    }
    downloadsConfigured = true;
    getOdooSession().on('will-download', (_event, item) => {
      const entry = historyStore.addDownload({
        filename: item.getFilename(),
        url: item.getURL(),
        path: item.getSavePath() || '',
        state: 'started',
      });
      item.once('done', (_e, state) => {
        const updated = historyStore.updateDownload(entry.id, {
          state,
          path: item.getSavePath() || entry.path,
          completedAt: new Date().toISOString(),
        });
        if (updated) {
          showDownloadNotification(updated, state);
        }
        const { windowRegistry } = require('./window-registry');
        windowRegistry.broadcastState();
      });
      const { windowRegistry } = require('./window-registry');
      windowRegistry.broadcastState();
    });
  }

  attachWindowLifecycle() {
    if (!this.window) {
      return;
    }
    this.window.on('closed', () => {
      this.tabs.forEach((tab) => {
        if (tab.view) {
          try {
            tab.view.webContents.close();
          } catch {
            void 0;
          }
        }
      });
      this.tabs = [];
      if (this.menuOverlayView) {
        try {
          this.menuOverlayView.webContents.close();
        } catch {
          void 0;
        }
        this.menuOverlayView = null;
        this.menuOverlayReady = null;
      }
      if (this.registry) {
        this.registry.unregister(this);
      }
    });
  }

  getPrintBannerHeight() {
    return this.printNotices.size > 0 ? PRINT_BANNER_HEIGHT : 0;
  }

  clearPrintNoticeTimer(id) {
    const timer = this.printNoticeTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.printNoticeTimers.delete(id);
    }
  }

  upsertPrintNotice(notice) {
    this.printNotices.set(notice.id, notice);
    this.clearPrintNoticeTimer(notice.id);
    if (notice.phase === 'completed') {
      this.printNoticeTimers.set(
        notice.id,
        setTimeout(() => {
          this.dismissPrintNotice(notice.id);
        }, 5000),
      );
    } else if (notice.phase === 'failed') {
      this.printNoticeTimers.set(
        notice.id,
        setTimeout(() => {
          this.dismissPrintNotice(notice.id);
        }, 12000),
      );
    }
    this.updateActiveViewBounds();
    this.updateMenuOverlayBounds();
    this.broadcastState();
  }

  dismissPrintNotice(id) {
    if (!this.printNotices.has(id)) {
      return;
    }
    this.clearPrintNoticeTimer(id);
    this.printNotices.delete(id);
    this.updateActiveViewBounds();
    this.updateMenuOverlayBounds();
    this.broadcastState();
  }

  getPrintNoticesForState() {
    return Array.from(this.printNotices.values()).sort((left, right) => left.updatedAt - right.updatedAt);
  }

  getChromeHeight() {
    let height = TITLEBAR_HEIGHT + TOOLBAR_HEIGHT + this.getPrintBannerHeight();
    if (this.findBarVisible) {
      height += FIND_BAR_HEIGHT;
    }
    return height;
  }

  getDefaultUrl() {
    return getDefaultBaseUrl(this.config);
  }

  createWindow(options = {}) {
    if (!historyStore.filePath) {
      historyStore.init();
    }

    this.window = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      show: false,
      backgroundColor: '#1e1f22',
      ...getBrowserWindowOptions(),
      webPreferences: {
        preload: path.join(__dirname, '../preload/shell-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    applyWindowChrome(this.window);

    attachWebContentsLogging(this.window.webContents, 'shell');
    attachInputShortcuts(this.registry, this.window.webContents);
    attachContextMenu(this.window.webContents, {
      getWindow: () => this.window,
    });

    this.window.webContents.on('did-finish-load', () => {
      this.updateActiveViewBounds();
      this.bootInitialContent(options);
      this.broadcastState();
    });

    this.window.once('ready-to-show', () => {
      this.window.show();
      this.updateActiveViewBounds();
      this.broadcastState();
      appLogger.add('info', 'app', t('Window ready'));
    });

    this.window.on('resize', () => {
      this.updateActiveViewBounds();
      this.updateMenuOverlayBounds();
    });
    this.window.loadFile(path.join(__dirname, '../renderer/shell.html'));
    return this.window;
  }

  bootInitialContent(options = {}) {
    if (this._initialContentBooted) {
      return;
    }
    this._initialContentBooted = true;
    if (options.skipInitialTab && this.pendingTabs?.length) {
      this.tabs = this.pendingTabs;
      this.pendingTabs = null;
      const activeId = this.pendingActiveTabId || this.tabs[0].id;
      this.pendingActiveTabId = null;
      this.switchTab(activeId);
      return;
    }
    if (!this.tabs.length) {
      this.openOrSwitchPanelTab(TAB_TYPES.HOME);
    }
  }

  getActiveTab() {
    return this.tabs.find((tab) => tab.id === this.activeTabId) || null;
  }

  getActiveWebContents() {
    const tab = this.getActiveTab();
    return isOdooTab(tab) && tab.view ? tab.view.webContents : null;
  }

  hideAllContentViews() {
    if (!this.window) {
      return;
    }
    this.tabs.forEach((tab) => {
      if (tab.view) {
        this.detachContentView(tab.view);
      }
    });
  }

  detachContentView(view) {
    if (!this.window || !view) {
      return;
    }
    try {
      this.window.contentView.removeChildView(view);
    } catch {
      void 0;
    }
  }

  createContentView() {
    const view = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, '../preload/odoo-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        session: getOdooSession(),
        spellcheck: this.modeManager.getMode() !== 'kiosk',
        backgroundThrottling: false,
      },
    });

    if (typeof view.setBackgroundColor === 'function') {
      view.setBackgroundColor('#FFFFFF');
    }

    attachWebContentsLogging(view.webContents, 'odoo');
    this.attachFindInPageListener(view.webContents);
    this.attachNavigationGuards(view.webContents);

    view.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
      if (this.modeManager.getMode() === 'kiosk') {
        if (isUrlAllowed(targetUrl, this.config.kioskAllowedHosts)) {
          view.webContents.loadURL(targetUrl);
        }
        return { action: 'deny' };
      }
      try {
        const tab = this.createOdooTab(targetUrl);
        this.switchTab(tab.id);
      } catch (error) {
        appLogger.add('error', 'tabs', error.message);
      }
      return { action: 'deny' };
    });

    const recordVisit = () => {
      const currentUrl = view.webContents.getURL();
      const tab = this.tabs.find((item) => item.view === view);
      if (currentUrl && tab) {
        tab.url = currentUrl;
        historyStore.addPageVisit(currentUrl, tab.title);
      }
      this.broadcastState();
    };

    view.webContents.on('did-navigate', recordVisit);
    view.webContents.on('did-navigate-in-page', recordVisit);
    view.webContents.on('page-title-updated', (_event, title) => {
      const tab = this.tabs.find((item) => item.view === view);
      if (tab) {
        tab.title = title;
        const currentUrl = view.webContents.getURL();
        if (currentUrl) {
          historyStore.addPageVisit(currentUrl, title);
        }
        this.broadcastState();
      }
    });
    view.webContents.on('did-start-loading', () => {
      const tab = this.tabs.find((item) => item.view === view);
      if (tab) {
        tab.isLoading = true;
      }
      this.broadcastState();
    });
    view.webContents.on('did-stop-loading', () => {
      const tab = this.tabs.find((item) => item.view === view);
      if (tab) {
        tab.isLoading = false;
      }
      this.broadcastState();
    });
    this.attachCompatibilityListener(view);
    attachInputShortcuts(this.registry, view.webContents);
    attachContextMenu(view.webContents, {
      getWindow: () => this.window,
      showNavigation: true,
      canGoBack: () => canGoBack(view.webContents),
      canGoForward: () => canGoForward(view.webContents),
      goBack: () => goBack(view.webContents),
      goForward: () => goForward(view.webContents),
      reload: () => view.webContents.reload(),
      onOpenLink: (url) => this.openLinkFromContext(url),
    });
    view.webContents.on('before-input-event', (event, input) => {
      const key = String(input.key || '').toLowerCase();
      const modifier = input.control || input.meta;
      const isFindShortcut =
        input.type === 'keyDown' && modifier && !input.shift && !input.alt && key === 'f';
      const isHardReloadShortcut =
        input.type === 'keyDown' && modifier && input.shift && !input.alt && key === 'r';
      if (isFindShortcut && this.window) {
        event.preventDefault();
        this.window.focus();
        this.window.webContents.focus();
        this.window.webContents.send('shell:action', { action: 'toggleFind' });
      }
      if (isHardReloadShortcut) {
        event.preventDefault();
        this.reload(true);
      }
    });

    view.webContents.on('dom-ready', () => {
      injectOdooPageShims(view.webContents);
    });
    view.webContents.on('did-finish-load', () => {
      injectOdooPageShims(view.webContents);
    });

    return view;
  }

  ensureOdooTabLoaded(tab) {
    if (!isOdooTab(tab) || !tab.view || !tab.url) {
      return;
    }
    const webContents = tab.view.webContents;
    if (webContents.isDestroyed() || tab.loadCommitted) {
      return;
    }
    const currentUrl = webContents.getURL();
    if (currentUrl && currentUrl !== 'about:blank') {
      tab.loadCommitted = true;
      return;
    }
    tab.loadCommitted = true;
    tab.isLoading = true;
    webContents.loadURL(tab.url).catch((error) => {
      tab.loadCommitted = false;
      tab.isLoading = false;
      appLogger.add('error', 'odoo', 'loadURL failed', error.message);
    });
  }

  attachCompatibilityListener(view) {
    const resolveTab = () => this.tabs.find((item) => item.view === view);

    const resetTabForInvalidPage = () => {
      const tab = resolveTab();
      if (!tab || view.webContents.isDestroyed()) {
        return;
      }
      tab.kioskCompatible = false;
      tab.isLoading = false;
      stopKioskDeviceSession(tab.view.webContents);
      this.broadcastState();
    };

    const runCheck = () => {
      const tab = resolveTab();
      if (!tab || view.webContents.isDestroyed()) {
        return;
      }
      const pageUrl = view.webContents.getURL();
      if (!isNavigableOdooUrl(pageUrl)) {
        resetTabForInvalidPage();
        return;
      }
      this.updateTabCompatibility(tab, pageUrl);
    };

    view.webContents.on('did-fail-load', () => {
      resetTabForInvalidPage();
    });
    view.webContents.on('did-navigate', runCheck);
    view.webContents.on('did-finish-load', runCheck);
    view.webContents.on('did-stop-loading', runCheck);
  }

  isOdooReachabilityError(result) {
    const detail = String(result?.error || '').toLowerCase();
    return detail.includes('connection')
      || detail.includes('network')
      || detail.includes('fetch failed')
      || detail.includes('err_connection');
  }

  updateTabCompatibility(tab, pageUrl) {
    if (!isOdooTab(tab) || !tab.view) {
      return;
    }
    if (!isNavigableOdooUrl(pageUrl)) {
      tab.kioskCompatible = false;
      stopKioskDeviceSession(tab.view.webContents);
      this.broadcastState();
      return;
    }
    const checkId = (tab._compatCheckId = (tab._compatCheckId || 0) + 1);
    checkKioskCompatibilityFromWebContents(tab.view.webContents).then((result) => {
      if (!this.tabs.includes(tab) || tab._compatCheckId !== checkId) {
        return;
      }
      tab.isLoading = false;
      if (!result) {
        tab.kioskCompatible = false;
        stopKioskDeviceSession(tab.view.webContents);
        this.broadcastState();
        return;
      }
      tab.kioskCompatible = result.compatible === true;
      if (tab.kioskCompatible) {
        appLogger.add('info', 'kiosk', t('Instance compatible'), pageUrl);
        attachKioskDeviceManager(tab.view.webContents, true);
      } else {
        stopKioskDeviceSession(tab.view.webContents);
        if (this.isOdooReachabilityError(result)) {
          appLogger.add('warn', 'kiosk', t('Cannot reach Odoo instance'), pageUrl);
        } else {
          const detail = result.status ? `HTTP ${result.status}` : (result.error || t('Unknown error'));
          appLogger.add('warn', 'kiosk', t('Instance not compatible'), pageUrl, detail);
        }
      }
      this.broadcastState();
    });
  }

  attachFindInPageListener(webContents) {
    if (!webContents || webContents._odooKioskFindAttached) {
      return;
    }
    webContents._odooKioskFindAttached = true;
    webContents.on('found-in-page', (_event, result) => {
      if (webContents !== this.getActiveWebContents()) {
        return;
      }
      this.findResult = formatFindStatus({
        query: this.currentFindQuery,
        matches: result.matches,
        activeMatchOrdinal: result.activeMatchOrdinal,
      });
      this.broadcastFindResult();
    });
  }

  attachNavigationGuards(webContents) {
    webContents.on('will-navigate', (event, targetUrl) => {
      if (!isNavigationRestricted(this.modeManager.getMode())) {
        return;
      }
      if (!isUrlAllowed(targetUrl, this.config.kioskAllowedHosts)) {
        event.preventDefault();
        appLogger.add('warn', 'navigation', t('Blocked in kiosk mode'), targetUrl);
      }
    });
  }

  getTabTitle(tab) {
    if (!tab) {
      return '';
    }
    if (tab.type !== TAB_TYPES.ODOO) {
      const panelTitle = PANEL_TITLES[tab.type];
      return panelTitle ? t(panelTitle) : tab.title;
    }
    return tab.title || tab.url || 'Odoo';
  }

  createOdooTab(url = null) {
    const targetUrl = url || this.getDefaultUrl();
    if (!canAddTab(this.tabs.length, this.config.maxTabs)) {
      throw new Error(`Maximum tab limit reached (${this.config.maxTabs})`);
    }

    const id = createTabId();
    const view = this.createContentView();
    const tab = {
      id,
      type: TAB_TYPES.ODOO,
      title: t('New tab'),
      url: targetUrl,
      view,
      kioskCompatible: false,
      isLoading: false,
      loadCommitted: false,
    };
    this.tabs.push(tab);
    appLogger.add('info', 'tabs', t('Odoo tab created'), id);
    return tab;
  }

  createPanelTab(type) {
    if (!canAddTab(this.tabs.length, this.config.maxTabs)) {
      throw new Error(`Maximum tab limit reached (${this.config.maxTabs})`);
    }
    const tab = {
      id: createTabId(),
      type,
      title: PANEL_TITLES[type] || type,
      url: '',
      view: null,
    };
    this.tabs.push(tab);
    appLogger.add('info', 'tabs', t('Panel tab created'), tab.id);
    return tab;
  }

  openOrSwitchPanelTab(type) {
    const existing = this.tabs.find((tab) => tab.type === type);
    if (existing) {
      this.switchTab(existing.id);
      return existing;
    }
    const tab = this.createPanelTab(type);
    this.switchTab(tab.id);
    return tab;
  }

  createTab(url = null) {
    return this.createOdooTab(url);
  }

  duplicateTab(tabId) {
    if (!this.modeManager.getCapabilities().canHaveTabs) {
      throw new Error('Tabs are disabled in kiosk mode');
    }
    const tab = this.tabs.find((item) => item.id === tabId);
    if (!tab) {
      throw new Error(`Tab not found: ${tabId}`);
    }
    if (isOdooTab(tab)) {
      const url = tab.view?.webContents?.getURL() || tab.url;
      if (!url || url.startsWith('about:')) {
        throw new Error('Cannot duplicate tab without URL');
      }
      const duplicated = this.createOdooTab(url);
      this.switchTab(duplicated.id);
      appLogger.add('info', 'tabs', t('Tab duplicated'), duplicated.id);
      return duplicated;
    }
    const duplicated = this.createPanelTab(tab.type);
    this.switchTab(duplicated.id);
    appLogger.add('info', 'tabs', t('Tab duplicated'), duplicated.id);
    return duplicated;
  }

  switchTab(tabId) {
    const tab = this.tabs.find((item) => item.id === tabId);
    if (!tab || !this.window) {
      return;
    }

    const isSameActiveOdooTab =
      this.activeTabId === tabId && isOdooTab(tab) && tab.view;

    if (!isSameActiveOdooTab) {
      this.hideAllContentViews();
      this.activeTabId = tabId;
    }

    if (isOdooTab(tab)) {
      tab.view.setBounds(this.getContentBounds());
      if (!isSameActiveOdooTab) {
        this.window.contentView.addChildView(tab.view);
      }
      tab.view.webContents.setZoomLevel(this.zoomLevel);
      tab.view.webContents.setBackgroundThrottling(false);
      this.ensureOdooTabLoaded(tab);
    } else if (!isSameActiveOdooTab) {
      this.activeTabId = tabId;
    }

    const title = this.getTabTitle(tab);
    if (this.window && !this.window.isDestroyed()) {
      this.window.setTitle(title);
    }
    if (this.menuOpen) {
      this.raiseMenuOverlay();
    }
    this.broadcastState();
  }

  moveTab(tabId, direction) {
    const index = this.tabs.findIndex((tab) => tab.id === tabId);
    const newIndex = index + direction;
    if (index === -1 || newIndex < 0 || newIndex >= this.tabs.length) {
      return;
    }
    this.reorderTab(tabId, newIndex);
  }

  reorderTab(tabId, newIndex) {
    const oldIndex = this.tabs.findIndex((tab) => tab.id === tabId);
    if (oldIndex === -1) {
      return;
    }
    let targetIndex = Math.max(0, Math.min(newIndex, this.tabs.length - 1));
    if (oldIndex === targetIndex) {
      return;
    }
    const [tab] = this.tabs.splice(oldIndex, 1);
    if (targetIndex > oldIndex) {
      targetIndex -= 1;
    }
    this.tabs.splice(targetIndex, 0, tab);
    this.broadcastState();
  }

  extractTab(tabId) {
    const index = this.tabs.findIndex((tab) => tab.id === tabId);
    if (index === -1) {
      return null;
    }
    const [tab] = this.tabs.splice(index, 1);
    if (tab.view) {
      stopKioskDeviceSession(tab.view.webContents);
      this.detachContentView(tab.view);
    }
    return { tab, index };
  }

  insertTab(tab, index, options = {}) {
    if (!tab) {
      return null;
    }
    if (SINGLETON_PANEL_TYPES.has(tab.type)) {
      const existing = this.tabs.find((item) => item.type === tab.type);
      if (existing) {
        if (tab.view) {
          if (tab.view.webContents.isDevToolsOpened()) {
            tab.view.webContents.closeDevTools();
          }
          tab.view.webContents.close();
        }
        if (options.activate) {
          this.switchTab(existing.id);
        } else {
          this.broadcastState();
        }
        return existing;
      }
    }
    if (!canAddTab(this.tabs.length, this.config.maxTabs)) {
      throw new Error(`Maximum tab limit reached (${this.config.maxTabs})`);
    }
    const safeIndex = Math.max(0, Math.min(index, this.tabs.length));
    this.tabs.splice(safeIndex, 0, tab);
    if (options.activate) {
      this.switchTab(tab.id);
    } else {
      this.broadcastState();
    }
    return tab;
  }

  handleAfterTabRemoved(removedTabId, removedIndex) {
    if (this.tabs.length === 0) {
      this.handleEmptyWindow();
      return;
    }
    if (this.activeTabId === removedTabId) {
      const nextTab = this.tabs[Math.max(0, removedIndex - 1)];
      this.switchTab(nextTab.id);
      return;
    }
    this.ensureHomeIfNoOdooTabs();
    this.broadcastState();
  }

  handleEmptyWindow() {
    const others = this.registry?.getAll().filter((manager) => manager.id !== this.id) || [];
    if (others.length > 0) {
      if (this.window && !this.window.isDestroyed()) {
        this.window.close();
      }
      return;
    }
    const home = this.createPanelTab(TAB_TYPES.HOME);
    this.switchTab(home.id);
  }

  detachTab(tabId, position = {}) {
    if (!this.modeManager.getCapabilities().canHaveTabs || !this.registry) {
      return null;
    }
    const extracted = this.extractTab(tabId);
    if (!extracted) {
      return null;
    }
    const bounds = this.window.getBounds();
    const target = this.registry.createWindowWithTabs([extracted.tab], {
      x: (position.screenX || bounds.x) - 120,
      y: (position.screenY || bounds.y) - 24,
      width: bounds.width,
      height: bounds.height,
    });
    this.handleAfterTabRemoved(tabId, extracted.index);
    appLogger.add('info', 'tabs', t('Tab detached to new window'), tabId);
    return target;
  }

  attachTabFrom(sourceWindowId, tabId, insertIndex) {
    if (!this.registry) {
      return null;
    }
    const source = this.registry.get(sourceWindowId);
    if (!source || source.id === this.id) {
      return null;
    }
    const extracted = source.extractTab(tabId);
    if (!extracted) {
      return null;
    }
    this.insertTab(extracted.tab, insertIndex, { activate: true });
    source.handleAfterTabRemoved(tabId, extracted.index);
    appLogger.add('info', 'tabs', t('Tab attached from another window'), tabId);
    return extracted.tab;
  }

  mergeWindowFrom(sourceWindowId, insertIndex = this.tabs.length) {
    if (!this.registry) {
      return false;
    }
    const source = this.registry.get(sourceWindowId);
    if (!source || source.id === this.id) {
      return false;
    }
    const movingTabs = [...source.tabs];
    if (!movingTabs.length) {
      return false;
    }
    source.tabs = [];
    source.activeTabId = null;
    source.hideAllContentViews();
    let index = insertIndex;
    let firstAttached = null;
    movingTabs.forEach((tab) => {
      try {
        const inserted = this.insertTab(tab, index, { activate: false });
        if (inserted) {
          if (!firstAttached) {
            firstAttached = inserted;
          }
          index += 1;
        }
      } catch (error) {
        if (tab.view) {
          tab.view.webContents.close();
        }
        appLogger.add('error', 'tabs', error.message);
      }
    });
    if (firstAttached) {
      this.switchTab(firstAttached.id);
    } else {
      this.broadcastState();
    }
    if (source.window && !source.window.isDestroyed()) {
      source.window.close();
    }
    appLogger.add('info', 'tabs', t('Window merged'), sourceWindowId);
    return true;
  }

  closeTab(tabId) {
    const index = this.tabs.findIndex((tab) => tab.id === tabId);
    if (index === -1) {
      return;
    }

    if (!this.modeManager.getCapabilities().canHaveTabs && this.tabs.length <= 1) {
      return;
    }

    const [removed] = this.tabs.splice(index, 1);
    if (removed.view) {
      stopKioskDeviceSession(removed.view.webContents);
      this.detachContentView(removed.view);
      if (removed.view.webContents.isDevToolsOpened()) {
        removed.view.webContents.closeDevTools();
      }
      removed.view.webContents.close();
    }

    this.handleAfterTabRemoved(tabId, index);
  }

  ensureHomeIfNoOdooTabs() {
    const hasOdoo = this.tabs.some((tab) => tab.type === TAB_TYPES.ODOO);
    const hasHome = this.tabs.some((tab) => tab.type === TAB_TYPES.HOME);
    if (!hasOdoo && !hasHome) {
      const home = this.createPanelTab(TAB_TYPES.HOME);
      if (!this.activeTabId) {
        this.switchTab(home.id);
      }
    }
  }

  openUrlInNewOdooTab(url) {
    const tab = this.createOdooTab(url);
    this.switchTab(tab.id);
    return tab;
  }

  setFindBarVisible(visible) {
    this.findBarVisible = Boolean(visible);
    this.updateActiveViewBounds();
    this.broadcastState();
  }

  setMenuOpen(open) {
    const nextOpen = Boolean(open);
    if (!nextOpen) {
      this.menuOverlayToken += 1;
      this.menuOpen = false;
      this.hideMenuOverlay();
      this.broadcastState();
      return;
    }
    this.menuOpen = true;
    this.showMenuOverlay();
    this.broadcastState();
  }

  getMenuOverlayBounds() {
    const bounds = this.window.getContentBounds();
    return {
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height,
    };
  }

  ensureMenuOverlayView() {
    if (this.menuOverlayView) {
      return this.menuOverlayReady || Promise.resolve();
    }

    this.menuOverlayView = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, '../preload/shell-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    if (typeof this.menuOverlayView.setBackgroundColor === 'function') {
      this.menuOverlayView.setBackgroundColor('#00000000');
    }

    attachWebContentsLogging(this.menuOverlayView.webContents, 'menu-overlay');
    attachInputShortcuts(this.registry, this.menuOverlayView.webContents);
    attachContextMenu(this.menuOverlayView.webContents, {
      getWindow: () => this.window,
    });
    this.menuOverlayReady = new Promise((resolve) => {
      this.menuOverlayView.webContents.once('did-finish-load', resolve);
    });
    this.menuOverlayView.webContents.loadFile(path.join(__dirname, '../renderer/shell.html'), {
      search: '?overlay=menu',
    });
    return this.menuOverlayReady;
  }

  updateMenuOverlayBounds() {
    if (!this.menuOverlayView || !this.window || this.window.isDestroyed()) {
      return;
    }
    this.menuOverlayView.setBounds(this.getMenuOverlayBounds());
  }

  raiseMenuOverlay() {
    if (!this.menuOverlayView || !this.window || this.window.isDestroyed()) {
      return;
    }
    this.updateMenuOverlayBounds();
    try {
      this.window.contentView.removeChildView(this.menuOverlayView);
    } catch {
      void 0;
    }
    this.window.contentView.addChildView(this.menuOverlayView);
  }

  showMenuOverlay() {
    if (!this.window || this.window.isDestroyed() || !this.menuOpen) {
      return;
    }
    const token = this.menuOverlayToken;
    this.ensureMenuOverlayView().then(() => {
      if (!this.menuOpen || token !== this.menuOverlayToken) {
        return;
      }
      this.raiseMenuOverlay();
      this.broadcastState();
    });
  }

  hideMenuOverlay() {
    if (!this.menuOverlayView || !this.window || this.window.isDestroyed()) {
      return;
    }
    this.detachContentView(this.menuOverlayView);
  }

  getContentBounds() {
    return calculateContentBounds(this.window.getContentBounds(), this.getChromeHeight(), 0);
  }

  updateActiveViewBounds() {
    if (!this.window) {
      return;
    }
    const tab = this.getActiveTab();
    if (!isOdooTab(tab) || !tab.view) {
      return;
    }
    tab.view.setBounds(this.getContentBounds());
  }

  openLinkFromContext(url) {
    if (this.modeManager.getMode() === 'kiosk') {
      if (isUrlAllowed(url, this.config.kioskAllowedHosts)) {
        this.navigate(url);
      }
      return;
    }
    try {
      const tab = this.createOdooTab(url);
      this.switchTab(tab.id);
    } catch (error) {
      appLogger.add('error', 'tabs', error.message);
    }
  }

  navigate(url) {
    const tab = this.getActiveTab();
    if (!isOdooTab(tab)) {
      this.openUrlInNewOdooTab(url);
      return;
    }
    const webContents = tab.view.webContents;
    if (isNavigationRestricted(this.modeManager.getMode()) && !isUrlAllowed(url, this.config.kioskAllowedHosts)) {
      throw new Error('Navigation blocked in kiosk mode');
    }
    appLogger.add('info', 'navigation', t('Navigating'), url);
    webContents.loadURL(url);
  }

  goBack() {
    const webContents = this.getActiveWebContents();
    if (canGoBack(webContents)) {
      goBack(webContents);
      appLogger.add('info', 'navigation', t('Back'));
    }
  }

  goForward() {
    const webContents = this.getActiveWebContents();
    if (canGoForward(webContents)) {
      goForward(webContents);
      appLogger.add('info', 'navigation', t('Forward'));
    }
  }

  reload(ignoreCache = false) {
    const webContents = this.getActiveWebContents();
    if (!webContents) {
      return;
    }
    if (ignoreCache) {
      webContents.reloadIgnoringCache();
      appLogger.add('info', 'navigation', t('Hard reload'));
      return;
    }
    webContents.reload();
    appLogger.add('info', 'navigation', t('Reload'));
  }

  setOdooDebug(level) {
    const webContents = this.getActiveWebContents();
    if (!webContents) {
      throw new Error('No hay pestaña Odoo activa');
    }
    const currentUrl = webContents.getURL();
    if (!currentUrl || currentUrl === 'about:blank') {
      throw new Error('No hay URL cargada');
    }
    const nextUrl = buildOdooDebugReloadUrl(currentUrl, level);
    const label = level === 'assets' ? 'debug=assets' : level === '1' ? 'debug=1' : 'sin debug';
    appLogger.add('info', 'odoo', t('Odoo developer mode enabled'), `${label} | ${nextUrl}`);
    webContents.loadURL(nextUrl).catch((error) => {
      appLogger.add('error', 'odoo', t('Odoo developer mode enabled'), error.message);
      webContents.reloadIgnoringCache();
    });
  }

  stop() {
    this.getActiveWebContents()?.stop();
  }

  home() {
    if (this.modeManager.getCapabilities().canHaveTabs) {
      this.openOrSwitchPanelTab(TAB_TYPES.HOME);
      return;
    }
    this.navigate(this.getDefaultUrl());
  }

  findInPage(text, options = {}) {
    const webContents = this.getActiveWebContents();
    if (!webContents || !text) {
      return null;
    }

    const followUp = Boolean(options.followUp);
    if (!followUp) {
      webContents.stopFindInPage('clearSelection');
      this.currentFindQuery = text;
    }

    const findOptions = buildFindOptions(options);
    this.findRequestId = webContents.findInPage(text, findOptions);
    appLogger.add('info', 'find', t('Find in page'), `${text} (${JSON.stringify(findOptions)})`);
    return {
      requestId: this.findRequestId,
      ...formatFindStatus({ query: text, matches: -1, activeMatchOrdinal: 0 }),
    };
  }

  stopFind(action = 'clearSelection') {
    const webContents = this.getActiveWebContents();
    webContents?.stopFindInPage(action);
    this.currentFindQuery = '';
    this.findRequestId = 0;
    this.findResult = formatFindStatus({ query: '', matches: 0, activeMatchOrdinal: 0 });
    this.broadcastFindResult();
  }

  broadcastFindResult() {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }
    this.window.webContents.send(IPC.SHELL_FIND_RESULT, this.findResult);
  }

  setZoom(delta) {
    const webContents = this.getActiveWebContents();
    if (!webContents) {
      return this.zoomLevel;
    }
    this.zoomLevel += delta;
    webContents.setZoomLevel(this.zoomLevel);
    this.broadcastState();
    return this.zoomLevel;
  }

  resetZoom() {
    this.zoomLevel = 0;
    this.getActiveWebContents()?.setZoomLevel(0);
    this.broadcastState();
    return this.zoomLevel;
  }

  toggleDevTools() {
    const webContents = this.getActiveWebContents();
    if (!webContents) {
      return false;
    }
    if (webContents.isDevToolsOpened()) {
      webContents.closeDevTools();
      return false;
    }
    webContents.openDevTools({ mode: 'detach' });
    return true;
  }

  applyModeChange(previousMode) {
    const mode = this.modeManager.getMode();
    const capabilities = this.modeManager.getCapabilities();

    if (!capabilities.canHaveTabs) {
      const toDestroy = [...this.tabs];
      this.tabs = [];
      this.activeTabId = null;
      toDestroy.forEach((tab) => {
        if (tab.view) {
          this.detachContentView(tab.view);
          if (tab.view.webContents.isDevToolsOpened()) {
            tab.view.webContents.closeDevTools();
          }
          tab.view.webContents.close();
        }
      });
      const odooTab = this.createOdooTab(this.getDefaultUrl());
      this.switchTab(odooTab.id);
    }

    const webContents = this.getActiveWebContents();
    if (webContents) {
      webContents.session.setSpellCheckerEnabled(mode !== 'kiosk');
      if (shouldAutoOpenDevTools(mode) && !webContents.isDevToolsOpened()) {
        webContents.openDevTools({ mode: 'detach' });
      }
      if (!shouldAutoOpenDevTools(mode) && shouldAutoOpenDevTools(previousMode) && webContents.isDevToolsOpened()) {
        webContents.closeDevTools();
      }
    }

    this.updateActiveViewBounds();
    this.broadcastState();
    appLogger.add('info', 'mode', t('Mode changed'), mode);
  }

  mapTabsForState() {
    return this.tabs.map((tab) => ({
      id: tab.id,
      type: tab.type,
      title: this.getTabTitle(tab),
      url: isOdooTab(tab) ? tab.view.webContents.getURL() || tab.url : '',
      active: tab.id === this.activeTabId,
      closable: this.modeManager.getCapabilities().canHaveTabs,
      kioskCompatible: isOdooTab(tab) ? Boolean(tab.kioskCompatible) : false,
      isLoading: isOdooTab(tab) ? Boolean(tab.isLoading) : false,
    }));
  }

  getState() {
    const activeTab = this.getActiveTab();
    const webContents = this.getActiveWebContents();
    const capabilities = this.modeManager.getCapabilities();
    const chromeHeight = this.getChromeHeight();
    return {
      windowId: this.id,
      platform: process.platform,
      mode: capabilities.mode,
      capabilities,
      tabs: this.mapTabsForState(),
      activeTabId: this.activeTabId,
      activeTabType: activeTab?.type || TAB_TYPES.ODOO,
      canGoBack: canGoBack(webContents),
      canGoForward: canGoForward(webContents),
      isLoading: webContents ? webContents.isLoading() : false,
      currentUrl: webContents ? webContents.getURL() : this.getDefaultUrl(),
      zoomLevel: this.zoomLevel,
      findBarVisible: this.findBarVisible,
      menuOpen: this.menuOpen,
      findResult: this.findResult,
      chromeHeight,
      printNotices: this.getPrintNoticesForState(),
      panelData: {
        logs: appLogger.getEntries(),
        instances: getInstancesSnapshot(this.config),
        ...historyStore.getSnapshot(),
      },
      isOdooTabActive: isOdooTab(activeTab),
      locale: getLocale(),
      i18nCatalog: getCatalog(),
      keymap: getKeymapForDisplay(process.platform, t),
    };
  }

  broadcastState() {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }
    const state = this.getState();
    this.window.webContents.send(IPC.SHELL_STATE_UPDATE, state);
    if (this.menuOverlayView && !this.menuOverlayView.webContents.isDestroyed()) {
      this.menuOverlayView.webContents.send(IPC.SHELL_STATE_UPDATE, state);
    }
  }
}

module.exports = { WindowManager, createTabId, calculateContentBounds, canAddTab, isOdooTab };
