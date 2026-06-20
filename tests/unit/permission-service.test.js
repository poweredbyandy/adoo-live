const { PERMISSION_TYPES } = require('../../src/shared/permission-types');
const {
  normalizePermissions,
  getPermissionsSnapshot,
  isPermissionGranted,
  isCameraPermission,
} = require('../../src/main/permission-service');

describe('permission-service', () => {
  it('normaliza permisos por defecto como denegados', () => {
    const snapshot = getPermissionsSnapshot({});
    expect(normalizePermissions({})).toEqual({
      printers: false,
      devices: false,
      camera: false,
      files: false,
    });
    expect(snapshot.printers).toBe(false);
    expect(snapshot.grantedAt.printers).toBeNull();
  });

  it('lee permisos guardados en la configuración', () => {
    const config = {
      permissions: { printers: true, devices: false, camera: true, files: false },
      permissionsGrantedAt: { printers: '2026-01-01T00:00:00.000Z', camera: '2026-01-02T00:00:00.000Z' },
    };
    expect(isPermissionGranted(config, PERMISSION_TYPES.PRINTERS)).toBe(true);
    expect(isPermissionGranted(config, PERMISSION_TYPES.DEVICES)).toBe(false);
    const snapshot = getPermissionsSnapshot(config);
    expect(snapshot.grantedAt.printers).toBe('2026-01-01T00:00:00.000Z');
    expect(snapshot.grantedAt.camera).toBe('2026-01-02T00:00:00.000Z');
    expect(snapshot.grantedAt.devices).toBeNull();
  });

  it('identifica permisos de cámara del navegador', () => {
    expect(isCameraPermission('media')).toBe(true);
    expect(isCameraPermission('camera')).toBe(true);
    expect(isCameraPermission('notifications')).toBe(false);
  });
});
