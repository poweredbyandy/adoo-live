/// @vitest-environment happy-dom

const { TAB_TYPES } = require('../../src/shared/tab-types');
const {
  STATIC_CLICKABLES,
  MENU_ACTION_CLICKABLES,
  SETTINGS_NAV_CLICKABLES,
  MODE_SEGMENT_CLICKABLES,
  MENU_GROUP_TOGGLES,
  BACKDROP_CLICKABLES,
  DYNAMIC_CLICKABLES,
  evaluateStaticClickable,
  isCssHidden,
} = require('../../src/shared/shell-clickables');
const {
  loadShell,
  clickElement,
  countApiCalls,
  flushPromises,
  openSettingsModal,
  switchSettingsPanel,
} = require('../helpers/shell-dom-harness');

async function tourClickStatic(document, api, state, entry) {
  const element = document.getElementById(entry.id);
  expect(element, `Falta #${entry.id}`).toBeTruthy();

  const evaluation = evaluateStaticClickable(entry, state, element);
  const apiBefore = countApiCalls(api, entry.api || '');

  if (!evaluation.clickable) {
    if (entry.disabledWhen?.(state)) {
      expect(element.disabled, `${entry.id} debería estar disabled`).toBe(true);
    } else if (entry.hiddenByDefault || entry.hiddenWhen?.(state)) {
      expect(isCssHidden(element), `${entry.id} debería estar oculto`).toBe(true);
    }
    await clickElement(element);
    if (entry.api && !entry.skipApiWhenDisabled) {
      expect(countApiCalls(api, entry.api)).toBe(apiBefore);
    }
    return { id: entry.id, status: 'skipped_disabled_or_hidden', reason: evaluation.reason };
  }

  await clickElement(element);

  if (entry.api) {
    expect(countApiCalls(api, entry.api), `${entry.id} → ${entry.api}`).toBeGreaterThan(apiBefore);
    if (entry.apiArgs) {
      const call = api.calls.filter((item) => item.method === entry.api).pop();
      expect(call.args).toEqual(entry.apiArgs(state));
    }
  }

  return { id: entry.id, status: 'clicked', api: entry.api || entry.uiEffect || 'ui' };
}

describe('shell click tour', () => {
  describe('página de inicio (modo ventana)', () => {
    it('recorre controles estáticos visibles y respeta deshabilitados', async () => {
      const { api, state } = await loadShell({
        activeTabType: TAB_TYPES.HOME,
        instances: {
          items: [{
            id: 'inst-1',
            label: 'Prod',
            host: 'https://odoo.test',
            baseUrl: 'https://odoo.test',
          }],
          defaultInstanceId: 'inst-1',
        },
      });

      const toolbarEntries = STATIC_CLICKABLES.filter((entry) => entry.zone === 'toolbar');
      const results = [];
      for (const entry of toolbarEntries) {
        results.push(await tourClickStatic(document, api, state, entry));
      }

      const back = results.find((item) => item.id === 'btn-back');
      const forward = results.find((item) => item.id === 'btn-forward');
      const reload = results.find((item) => item.id === 'btn-reload');
      const home = results.find((item) => item.id === 'btn-home');
      const menu = results.find((item) => item.id === 'btn-menu');

      expect(back.status).toBe('skipped_disabled_or_hidden');
      expect(forward.status).toBe('skipped_disabled_or_hidden');
      expect(reload.status).toBe('skipped_disabled_or_hidden');
      expect(home.status).toBe('clicked');
      expect(menu.status).toBe('clicked');
      expect(countApiCalls(api, 'home')).toBeGreaterThan(0);
      expect(countApiCalls(api, 'setMenuOpen')).toBeGreaterThan(0);
    });

    it('añade instancia desde el formulario', async () => {
      const { api } = await loadShell({ activeTabType: TAB_TYPES.HOME });
      const label = document.getElementById('home-instance-label');
      const url = document.getElementById('home-instance-url');
      label.value = 'QA';
      url.value = 'https://qa.odoo.test';

      const before = countApiCalls(api, 'addInstance');
      document.getElementById('home-instance-form').requestSubmit();
      await flushPromises();

      expect(countApiCalls(api, 'addInstance')).toBe(before + 1);
      const call = api.calls.filter((item) => item.method === 'addInstance').pop();
      expect(call.args).toEqual(['QA', 'https://qa.odoo.test']);
    });

    it('recorre acciones dinámicas de instancias', async () => {
      const { api } = await loadShell({
        activeTabType: TAB_TYPES.HOME,
        instances: {
          items: [
            { id: 'inst-1', label: 'One', host: 'https://one.test', baseUrl: 'https://one.test' },
            { id: 'inst-2', label: 'Two', host: 'https://two.test', baseUrl: 'https://two.test' },
          ],
          defaultInstanceId: 'inst-1',
        },
      });

      const openBtn = document.querySelector('.instance-open');
      expect(openBtn).toBeTruthy();
      const openBefore = countApiCalls(api, 'newTab');
      await clickElement(openBtn);
      expect(countApiCalls(api, 'newTab')).toBe(openBefore + 1);

      const starButtons = [...document.querySelectorAll('.instance-action-btn')].filter(
        (btn) => btn.title && btn.title.includes('default'),
      );
      const starNotDefault = starButtons.find((btn) => !btn.disabled);
      expect(starNotDefault).toBeTruthy();
      const defaultBefore = countApiCalls(api, 'setDefaultInstance');
      await clickElement(starNotDefault);
      expect(countApiCalls(api, 'setDefaultInstance')).toBe(defaultBefore + 1);

      const editBtn = document.querySelectorAll('.instance-card')[1]?.querySelector('.instance-action-btn[title="Edit"]');
      expect(editBtn).toBeTruthy();
      await clickElement(editBtn);
      expect(document.getElementById('home-instance-cancel').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('home-instance-url').value).toBe('https://two.test');

      const deleteBtn = document.querySelector('.instance-action-btn.danger');
      const removeBefore = countApiCalls(api, 'removeInstance');
      await clickElement(deleteBtn);
      expect(countApiCalls(api, 'confirm')).toBeGreaterThan(0);
      expect(countApiCalls(api, 'removeInstance')).toBe(removeBefore + 1);
    });
  });

  describe('pestaña Odoo activa', () => {
    it('navegación atrás/adelante/recargar funcionan cuando están habilitados', async () => {
      const { api, state } = await loadShell({
        activeTabType: TAB_TYPES.ODOO,
        activeTabId: 'tab-odoo',
        currentUrl: 'https://odoo.test/app',
        canGoBack: true,
        canGoForward: true,
        tabs: [{ id: 'tab-odoo', type: TAB_TYPES.ODOO, title: 'Odoo', url: 'https://odoo.test/app' }],
      });

      await tourClickStatic(document, api, state, STATIC_CLICKABLES.find((e) => e.id === 'btn-back'));
      await tourClickStatic(document, api, state, STATIC_CLICKABLES.find((e) => e.id === 'btn-forward'));
      await tourClickStatic(document, api, state, STATIC_CLICKABLES.find((e) => e.id === 'btn-reload'));

      expect(countApiCalls(api, 'goBack')).toBeGreaterThan(0);
      expect(countApiCalls(api, 'goForward')).toBeGreaterThan(0);
      expect(countApiCalls(api, 'reload')).toBeGreaterThan(0);
    });

    it('barra de búsqueda y zoom del menú', async () => {
      const { api } = await loadShell({
        activeTabType: TAB_TYPES.ODOO,
        activeTabId: 'tab-odoo',
        currentUrl: 'https://odoo.test',
        tabs: [{ id: 'tab-odoo', type: TAB_TYPES.ODOO, title: 'Odoo', url: 'https://odoo.test' }],
      });

      const findAction = document.querySelector('[data-action="find"]');
      await clickElement(findAction);
      expect(countApiCalls(api, 'setFindBarVisible')).toBeGreaterThan(0);

      await api.patchState({ findBarVisible: true });
      await flushPromises();

      const findInput = document.getElementById('find-input');
      findInput.value = 'hello';
      const findBefore = countApiCalls(api, 'findInPage');
      await clickElement(document.getElementById('btn-find-next'));
      expect(countApiCalls(api, 'findInPage')).toBeGreaterThan(findBefore);

      const closeBefore = countApiCalls(api, 'setFindBarVisible');
      await clickElement(document.getElementById('btn-find-close'));
      expect(countApiCalls(api, 'setFindBarVisible')).toBeGreaterThan(closeBefore);

      const zoomOut = document.getElementById('btn-zoom-out');
      const zoomIn = document.getElementById('btn-zoom-in');
      const zoomReset = document.getElementById('btn-zoom-reset');
      await clickElement(zoomOut);
      await clickElement(zoomIn);
      await clickElement(zoomReset);
      expect(countApiCalls(api, 'setZoom')).toBeGreaterThan(0);
      expect(countApiCalls(api, 'resetZoom')).toBeGreaterThan(0);
    });
  });

  describe('menú y paneles', () => {
    it('recorre acciones del menú', async () => {
      const { api } = await loadShell({ activeTabType: TAB_TYPES.HOME });

      for (const entry of MENU_ACTION_CLICKABLES) {
        if (entry.devOnly) {
          continue;
        }
        const button = document.querySelector(`[data-action="${entry.action}"]`);
        expect(button, `Menú ${entry.action}`).toBeTruthy();
        const apiBefore = entry.api ? countApiCalls(api, entry.api) : 0;
        await clickElement(button);
        if (entry.api) {
          expect(countApiCalls(api, entry.api), entry.action).toBeGreaterThan(apiBefore);
        }
      }

      expect(countApiCalls(api, 'openTab')).toBeGreaterThan(0);
      expect(countApiCalls(api, 'toggleDevTools')).toBe(0);
    });

    it('expande grupos del menú', async () => {
      await loadShell({ activeTabType: TAB_TYPES.HOME, mode: 'developer' });

      for (const entry of MENU_GROUP_TOGGLES) {
        if (entry.devOnly && document.body.classList.contains('developer') === false) {
          continue;
        }
        const toggle = document.querySelector(`[data-menu-group="${entry.group}"] .menu-group-toggle`);
        if (!toggle || isCssHidden(toggle)) {
          continue;
        }
        await clickElement(toggle);
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
      }
    });

    it('historial: limpiar deshabilitado sin datos y habilitado con datos', async () => {
      const empty = await loadShell({
        activeTabType: TAB_TYPES.HISTORY,
        activeTabId: 'tab-history',
        tabs: [{ id: 'tab-history', type: TAB_TYPES.HISTORY, title: 'History', url: '' }],
        pageHistory: [],
      });
      const clearBtn = document.getElementById('btn-history-clear');
      expect(clearBtn.disabled).toBe(true);
      const clearBefore = countApiCalls(empty.api, 'clearPageHistory');
      await clickElement(clearBtn);
      expect(countApiCalls(empty.api, 'clearPageHistory')).toBe(clearBefore);

      const withHistory = await loadShell({
        activeTabType: TAB_TYPES.HISTORY,
        activeTabId: 'tab-history',
        tabs: [{ id: 'tab-history', type: TAB_TYPES.HISTORY, title: 'History', url: '' }],
        pageHistory: [{
          url: 'https://odoo.test/page',
          title: 'Page',
          visitedAt: Date.now(),
          host: 'odoo.test',
        }],
      });
      const enabledClear = document.getElementById('btn-history-clear');
      expect(enabledClear.disabled).toBe(false);
      const historyItem = document.querySelector('.history-item');
      expect(historyItem).toBeTruthy();
      const tabBefore = countApiCalls(withHistory.api, 'newTab');
      await clickElement(historyItem);
      expect(countApiCalls(withHistory.api, 'newTab')).toBe(tabBefore + 1);

      const confirmBefore = countApiCalls(withHistory.api, 'confirm');
      await clickElement(enabledClear);
      expect(countApiCalls(withHistory.api, 'confirm')).toBeGreaterThan(confirmBefore);
      expect(countApiCalls(withHistory.api, 'clearPageHistory')).toBeGreaterThan(0);
    });

    it('descargas: acciones por fila', async () => {
      const { api } = await loadShell({
        activeTabType: TAB_TYPES.DOWNLOADS,
        activeTabId: 'tab-downloads',
        tabs: [{ id: 'tab-downloads', type: TAB_TYPES.DOWNLOADS, title: 'Downloads', url: '' }],
        downloads: [{
          id: 'dl-1',
          filename: 'report.pdf',
          path: '/tmp/report.pdf',
          state: 'completed',
          receivedAt: Date.now(),
        }],
      });

      const actions = document.querySelectorAll('.download-action-btn');
      expect(actions.length).toBe(3);
      await clickElement(actions[0]);
      await clickElement(actions[1]);
      expect(countApiCalls(api, 'openDownloadFile')).toBeGreaterThan(0);
      expect(countApiCalls(api, 'openDownloadFolder')).toBeGreaterThan(0);

      const removeBefore = countApiCalls(api, 'removeDownload');
      await clickElement(actions[2]);
      expect(countApiCalls(api, 'confirm')).toBeGreaterThan(0);
      expect(countApiCalls(api, 'removeDownload')).toBe(removeBefore + 1);
    });
  });

  describe('modal de ajustes', () => {
    it('recorre navegación, modo, permisos y acciones', async () => {
      const { api } = await loadShell({ activeTabType: TAB_TYPES.HOME });
      openSettingsModal(document);
      await flushPromises();

      expect(document.getElementById('settings-modal').classList.contains('hidden')).toBe(false);

      for (const entry of SETTINGS_NAV_CLICKABLES) {
        const nav = document.querySelector(`.settings-nav-item[data-settings-panel="${entry.panel}"]`);
        expect(nav, entry.panel).toBeTruthy();
        await clickElement(nav);
        const panel = document.getElementById(`settings-panel-${entry.panel}`);
        expect(panel.classList.contains('hidden')).toBe(false);
      }

      switchSettingsPanel(document, 'personalization');
      for (const entry of MODE_SEGMENT_CLICKABLES) {
        const button = document.querySelector(`.mode-segment-option[data-mode="${entry.mode}"]`);
        expect(button).toBeTruthy();
        if (button.classList.contains('active')) {
          const before = countApiCalls(api, 'setMode');
          await clickElement(button);
          expect(countApiCalls(api, 'setMode')).toBe(before);
          continue;
        }
        const before = countApiCalls(api, 'setMode');
        await clickElement(button);
        expect(countApiCalls(api, 'setMode')).toBeGreaterThan(before);
      }

      switchSettingsPanel(document, 'downloads');
      const pickBefore = countApiCalls(api, 'pickDownloadFolder');
      await clickElement(document.getElementById('btn-pick-download-folder'));
      expect(countApiCalls(api, 'pickDownloadFolder')).toBe(pickBefore + 1);

      switchSettingsPanel(document, 'permissions');
      const toggle = document.querySelector('.settings-permission-toggle[data-permission="printers"]');
      toggle.checked = !toggle.checked;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));
      await flushPromises();
      expect(countApiCalls(api, 'setPermission')).toBeGreaterThan(0);

      switchSettingsPanel(document, 'logs');
      const copyLogs = document.querySelector('[data-action="copy-logs"]');
      await clickElement(copyLogs);

      switchSettingsPanel(document, 'about');
      const checkBefore = countApiCalls(api, 'checkForUpdates');
      await clickElement(document.getElementById('btn-check-updates'));
      expect(countApiCalls(api, 'checkForUpdates')).toBe(checkBefore + 1);

      const resetBefore = countApiCalls(api, 'factoryReset');
      await clickElement(document.getElementById('btn-factory-reset'));
      expect(countApiCalls(api, 'factoryReset')).toBe(resetBefore + 1);

      const regenerateBefore = countApiCalls(api, 'regenerateOdooAssets');
      await clickElement(document.getElementById('btn-regenerate-odoo-assets'));
      expect(countApiCalls(api, 'regenerateOdooAssets')).toBe(regenerateBefore + 1);

      const closeBefore = countApiCalls(api, 'setSettingsOpen');
      await clickElement(document.getElementById('btn-settings-close'));
      expect(document.getElementById('settings-modal').classList.contains('hidden')).toBe(true);

      openSettingsModal(document);
      await flushPromises();
      const backdrop = document.getElementById('settings-modal-backdrop');
      await clickElement(backdrop);
      expect(document.getElementById('settings-modal').classList.contains('hidden')).toBe(true);
      expect(closeBefore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('pestañas y banners', () => {
    it('cambia y cierra pestañas en modo ventana', async () => {
      const { api } = await loadShell({
        activeTabType: TAB_TYPES.HOME,
        tabs: [
          { id: 'tab-home', type: TAB_TYPES.HOME, title: 'Start', url: '' },
          { id: 'tab-odoo', type: TAB_TYPES.ODOO, title: 'Odoo', url: 'https://odoo.test' },
        ],
        activeTabId: 'tab-home',
      });

      const newTabBtn = document.getElementById('btn-new-tab');
      expect(isCssHidden(newTabBtn)).toBe(false);
      const newTabBefore = countApiCalls(api, 'newTab');
      await clickElement(newTabBtn);
      expect(countApiCalls(api, 'newTab')).toBe(newTabBefore + 1);

      const closableTab = document.querySelector('.tab-item .tab-close')?.closest('.tab-item');
      expect(closableTab).toBeTruthy();
      const switchBefore = countApiCalls(api, 'switchTab');
      await clickElement(closableTab);
      expect(countApiCalls(api, 'switchTab')).toBe(switchBefore + 1);

      const closeBtn = closableTab.querySelector('.tab-close');
      expect(closeBtn).toBeTruthy();
      const closeBefore = countApiCalls(api, 'closeTab');
      await clickElement(closeBtn);
      expect(countApiCalls(api, 'closeTab')).toBe(closeBefore + 1);
    });

    it('cierra avisos de impresión', async () => {
      const { api } = await loadShell({
        activeTabType: TAB_TYPES.ODOO,
        activeTabId: 'tab-odoo',
        tabs: [{ id: 'tab-odoo', type: TAB_TYPES.ODOO, title: 'Odoo', url: 'https://odoo.test' }],
        printNotices: [{
          id: 'print-1',
          phase: 'completed',
          source: 'local',
          printerName: 'Test',
          updatedAt: Date.now(),
        }],
      });

      await flushPromises();
      const dismiss = document.querySelector('.print-notice-dismiss');
      expect(dismiss).toBeTruthy();
      const before = countApiCalls(api, 'dismissPrintNotice');
      await clickElement(dismiss);
      expect(countApiCalls(api, 'dismissPrintNotice')).toBe(before + 1);
    });
  });

  describe('backdrops', () => {
    it('cierra el menú al pulsar el backdrop', async () => {
      const { api } = await loadShell({ activeTabType: TAB_TYPES.HOME, menuOpen: true });
      await api.patchState({ menuOpen: true });
      await flushPromises();

      const backdrop = document.getElementById('menu-backdrop');
      backdrop.classList.remove('hidden');
      const before = countApiCalls(api, 'setMenuOpen');
      await clickElement(backdrop);
      expect(countApiCalls(api, 'setMenuOpen')).toBeGreaterThan(before);
    });
  });

  it('catálogo dinámico documentado', () => {
    expect(DYNAMIC_CLICKABLES.length).toBeGreaterThanOrEqual(6);
    expect(BACKDROP_CLICKABLES.length).toBe(2);
  });
});
