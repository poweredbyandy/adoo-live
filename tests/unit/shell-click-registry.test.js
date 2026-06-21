const fs = require('fs');
const {
  STATIC_CLICKABLES,
  MENU_ACTION_CLICKABLES,
  SETTINGS_NAV_CLICKABLES,
  MODE_SEGMENT_CLICKABLES,
  MENU_GROUP_TOGGLES,
  BACKDROP_CLICKABLES,
  listTrackedStaticIds,
  listAllMenuActions,
  evaluateStaticClickable,
} = require('../../src/shared/shell-clickables');
const {
  extractShellHtmlButtonIds,
  extractShellHtmlMenuActions,
  SHELL_HTML_PATH,
} = require('../helpers/shell-dom-harness');

describe('shell-clickables registry', () => {
  const shellHtml = fs.readFileSync(SHELL_HTML_PATH, 'utf8');
  const htmlButtonIds = extractShellHtmlButtonIds(shellHtml);
  const htmlMenuActions = extractShellHtmlMenuActions(shellHtml);
  const trackedIds = listTrackedStaticIds();
  const trackedMenuActions = listAllMenuActions();

  it('registra todos los botones con id del shell.html', () => {
    const missing = [...htmlButtonIds].filter((id) => !trackedIds.includes(id));
    expect(missing, `IDs sin registrar: ${missing.join(', ')}`).toEqual([]);
  });

  it('no declara ids estáticos que ya no existen en shell.html', () => {
    const stale = trackedIds.filter((id) => !htmlButtonIds.has(id));
    expect(stale, `IDs obsoletos: ${stale.join(', ')}`).toEqual([]);
  });

  it('registra todas las acciones data-action del menú y ajustes', () => {
    const missing = [...htmlMenuActions].filter((action) => !trackedMenuActions.includes(action));
    expect(missing, `Acciones sin registrar: ${missing.join(', ')}`).toEqual([]);
  });

  it('cada entrada estática tiene zona y etiqueta', () => {
    STATIC_CLICKABLES.forEach((entry) => {
      expect(entry.id).toBeTruthy();
      expect(entry.zone).toBeTruthy();
      expect(entry.label).toBeTruthy();
    });
  });

  it('cada acción de menú tiene api o efecto UI', () => {
    MENU_ACTION_CLICKABLES.forEach((entry) => {
      expect(entry.action).toBeTruthy();
      expect(entry.api || entry.uiEffect).toBeTruthy();
    });
  });

  it('cubre navegación de ajustes y segmentos de modo', () => {
    expect(SETTINGS_NAV_CLICKABLES.length).toBe(6);
    expect(MODE_SEGMENT_CLICKABLES.length).toBe(3);
    expect(MENU_GROUP_TOGGLES.length).toBe(3);
    expect(BACKDROP_CLICKABLES.length).toBe(2);
  });
});

describe('shell-clickables evaluación', () => {
  const homeState = {
    isOdooTabActive: false,
    canGoBack: false,
    canGoForward: false,
    findBarVisible: false,
    menuOpen: false,
    capabilities: { canHaveTabs: true },
    panelData: { pageHistory: [] },
  };

  it('marca atrás/adelante/recargar como no clicables en inicio', () => {
    const back = { disabled: true };
    const forward = { disabled: true };
    const reload = { disabled: true };
    expect(evaluateStaticClickable(
      STATIC_CLICKABLES.find((e) => e.id === 'btn-back'),
      homeState,
      back,
    ).clickable).toBe(false);
    expect(evaluateStaticClickable(
      STATIC_CLICKABLES.find((e) => e.id === 'btn-forward'),
      homeState,
      forward,
    ).clickable).toBe(false);
    expect(evaluateStaticClickable(
      STATIC_CLICKABLES.find((e) => e.id === 'btn-reload'),
      homeState,
      reload,
    ).clickable).toBe(false);
  });

  it('marca limpiar historial deshabilitado sin entradas', () => {
    const clearBtn = { disabled: true };
    const entry = STATIC_CLICKABLES.find((e) => e.id === 'btn-history-clear');
    expect(evaluateStaticClickable(entry, homeState, clearBtn).clickable).toBe(false);
  });
});
