const { HistoryStore, extractInstance } = require('../../src/main/history-store');

describe('history-store', () => {
  let store;

  beforeEach(() => {
    store = new HistoryStore();
    store.filePath = null;
  });

  it('extrae instancia desde URL http', () => {
    const instance = extractInstance('https://odoo.example.com/web');
    expect(instance).toEqual({
      origin: 'https://odoo.example.com',
      host: 'odoo.example.com',
      label: 'odoo.example.com',
      baseUrl: 'https://odoo.example.com',
    });
  });

  it('registra visitas y deduplica por URL', () => {
    store.addPageVisit('https://a.odoo.test/web', 'Inicio');
    store.addPageVisit('https://a.odoo.test/shop', 'Tienda');
    store.addPageVisit('https://a.odoo.test/web', 'Inicio otra vez');

    expect(store.pageHistory).toHaveLength(2);
    expect(store.pageHistory[0].url).toBe('https://a.odoo.test/web');
    expect(store.pageHistory[0].title).toBe('Inicio otra vez');
  });

  it('mantiene instancias recientes por origen', () => {
    store.addRecentInstance('https://one.odoo.test');
    store.addRecentInstance('https://two.odoo.test');
    store.addRecentInstance('https://one.odoo.test/app');

    expect(store.recentInstances).toHaveLength(2);
    expect(store.recentInstances[0].origin).toBe('https://one.odoo.test');
    expect(store.recentInstances[1].origin).toBe('https://two.odoo.test');
  });

  it('limpia el historial de páginas', () => {
    store.addPageVisit('https://a.odoo.test/web', 'Inicio');
    store.clearPageHistory();
    expect(store.pageHistory).toHaveLength(0);
    expect(store.getSnapshot().pageHistory).toHaveLength(0);
  });

  it('registra y actualiza descargas', () => {
    const entry = store.addDownload({
      filename: 'reporte.pdf',
      url: 'https://odoo.test/report.pdf',
      state: 'started',
    });

    const updated = store.updateDownload(entry.id, {
      state: 'completed',
      path: '/tmp/reporte.pdf',
      completedAt: '2026-06-09T12:00:00.000Z',
    });

    expect(updated.state).toBe('completed');
    expect(updated.path).toBe('/tmp/reporte.pdf');
    expect(store.getSnapshot().downloads[0].id).toBe(entry.id);
  });
});
