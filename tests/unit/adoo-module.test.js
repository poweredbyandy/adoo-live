const {
  buildAdooModuleAssetUrl,
  buildAdooModuleManifestUrl,
  getOriginStorageKey,
  isAdooModuleCacheCurrent,
  isSafeRelativeAssetPath,
  normalizeAdooModuleManifest,
} = require('../../src/shared/adoo-module');

describe('adoo-module', () => {
  it('construye URLs del manifest y activos', () => {
    const origin = 'https://odoo.example.com';
    expect(buildAdooModuleManifestUrl(origin)).toBe('https://odoo.example.com/adoo_module/manifest.json');
    expect(buildAdooModuleAssetUrl(origin, 'native/device.dll')).toBe(
      'https://odoo.example.com/adoo_module/native/device.dll',
    );
  });

  it('genera claves de almacenamiento por origen', () => {
    expect(getOriginStorageKey('https://odoo.example.com')).toBe('odoo.example.com');
    expect(getOriginStorageKey('http://localhost:8069')).toBe('localhost-8069');
  });

  it('normaliza el manifest y valida rutas', () => {
    const manifest = normalizeAdooModuleManifest({
      version: '2.1.0',
      files: [
        'index.js',
        { path: 'native/win32-x64/device.node', sha256: 'abc' },
        '../escape.js',
      ],
    });
    expect(manifest.version).toBe('2.1.0');
    expect(manifest.files).toEqual([
      { path: 'index.js' },
      { path: 'native/win32-x64/device.node', sha256: 'abc' },
    ]);
    expect(isSafeRelativeAssetPath('manifest.json')).toBe(false);
    expect(isSafeRelativeAssetPath('../bad.js')).toBe(false);
    expect(isSafeRelativeAssetPath('lib/plugin.js')).toBe(true);
  });

  it('detecta caché vigente por versión del manifest', () => {
    const local = normalizeAdooModuleManifest({ version: '1.0.0', files: ['index.js'] });
    const remote = normalizeAdooModuleManifest({ version: '1.0.0', files: ['index.js'] });
    const newer = normalizeAdooModuleManifest({ version: '1.0.1', files: ['index.js'] });
    expect(isAdooModuleCacheCurrent(local, remote)).toBe(true);
    expect(isAdooModuleCacheCurrent(local, newer)).toBe(false);
  });
});
