const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  cleanupStaleUpdaterCache,
  getUpdaterCacheInfo,
  hasPendingUpdateDownload,
} = require('../../src/main/update-cache-service');

describe('update-cache-service', () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'adoo-updater-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('expone la ruta de caché del updater', () => {
    const info = getUpdaterCacheInfo({
      baseCachePath: tempRoot,
      cacheDirName: 'adoo IoT-updater',
    });
    expect(info.cachePath).toBe(path.join(tempRoot, 'adoo IoT-updater'));
    expect(info.pendingPath).toBe(path.join(tempRoot, 'adoo IoT-updater', 'pending'));
  });

  it('detecta una actualización pendiente válida', () => {
    const pendingPath = path.join(tempRoot, 'pending');
    fs.mkdirSync(pendingPath, { recursive: true });
    fs.writeFileSync(path.join(pendingPath, 'update-info.json'), JSON.stringify({ fileName: 'setup.exe' }));
    fs.writeFileSync(path.join(pendingPath, 'setup.exe'), 'binary');

    expect(hasPendingUpdateDownload(pendingPath)).toBe(true);
  });

  it('limpia pending cuando no hay actualización pendiente', async () => {
    const pendingPath = path.join(tempRoot, 'adoo IoT-updater', 'pending');
    fs.mkdirSync(pendingPath, { recursive: true });
    fs.writeFileSync(path.join(pendingPath, 'old-setup.exe'), 'binary');

    const result = await cleanupStaleUpdaterCache({
      baseCachePath: tempRoot,
      cacheDirName: 'adoo IoT-updater',
    });
    expect(result.cleaned).toBe(true);
    expect(fs.readdirSync(pendingPath)).toEqual([]);
  });

  it('no limpia cuando hay una actualización descargada lista para instalar', async () => {
    const pendingPath = path.join(tempRoot, 'adoo IoT-updater', 'pending');
    fs.mkdirSync(pendingPath, { recursive: true });
    fs.writeFileSync(path.join(pendingPath, 'update-info.json'), JSON.stringify({ fileName: 'setup.exe' }));
    fs.writeFileSync(path.join(pendingPath, 'setup.exe'), 'binary');

    const result = await cleanupStaleUpdaterCache({
      baseCachePath: tempRoot,
      cacheDirName: 'adoo IoT-updater',
    });
    expect(result.cleaned).toBe(false);
    expect(result.reason).toBe('pending_update');
    expect(fs.existsSync(path.join(pendingPath, 'setup.exe'))).toBe(true);
  });
});
