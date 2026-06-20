const { buildDownloadNotification } = require('../../src/main/notification-service');

describe('notification-service', () => {
  it('genera notificación para descarga completada', () => {
    const payload = buildDownloadNotification({ filename: 'reporte.pdf' }, 'completed');
    expect(payload).toEqual({
      title: 'Descarga completada',
      body: 'reporte.pdf',
      action: 'open-downloads',
    });
  });

  it('genera notificación para descarga cancelada', () => {
    const payload = buildDownloadNotification({ filename: 'datos.xlsx' }, 'cancelled');
    expect(payload?.title).toBe('Descarga cancelada');
    expect(payload?.silent).toBe(true);
  });

  it('no genera notificación para estados desconocidos', () => {
    expect(buildDownloadNotification({ filename: 'a.txt' }, 'started')).toBeNull();
  });
});
