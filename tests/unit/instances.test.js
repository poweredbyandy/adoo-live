const {
  resolveInstancesConfig,
  getDefaultBaseUrl,
  addInstance,
  updateInstance,
  removeInstance,
  setDefaultInstance,
  normalizeInstanceInput,
  setPersistHandler,
} = require('../../src/main/instances');

describe('instances', () => {
  afterEach(() => {
    setPersistHandler(null);
  });
  it('normaliza URLs de instancia al origen', () => {
    expect(normalizeInstanceInput('odoo.example.com/web')).toEqual({
      origin: 'https://odoo.example.com',
      host: 'odoo.example.com',
      label: 'odoo.example.com',
      baseUrl: 'https://odoo.example.com',
    });
  });

  it('migra baseUrl legacy a una instancia configurada', () => {
    const resolved = resolveInstancesConfig({ baseUrl: 'https://legacy.odoo.test' });
    expect(resolved.instances).toHaveLength(1);
    expect(resolved.instances[0].baseUrl).toBe('https://legacy.odoo.test');
    expect(resolved.defaultInstanceId).toBe(resolved.instances[0].id);
    expect(getDefaultBaseUrl(resolved)).toBe('https://legacy.odoo.test');
  });

  it('añade, edita, marca predeterminada y elimina instancias', () => {
    setPersistHandler(() => {});
    let config = resolveInstancesConfig({ baseUrl: 'https://one.odoo.test' });
    let snapshot = addInstance(config, 'Dos', 'https://two.odoo.test');
    expect(snapshot.items).toHaveLength(2);

    config = resolveInstancesConfig({
      instances: snapshot.items,
      defaultInstanceId: snapshot.defaultInstanceId,
      baseUrl: snapshot.defaultBaseUrl,
    });

    snapshot = addInstance(config, 'Tres', 'https://three.odoo.test');
    config = resolveInstancesConfig({
      instances: snapshot.items,
      defaultInstanceId: snapshot.defaultInstanceId,
      baseUrl: snapshot.defaultBaseUrl,
    });
    expect(snapshot.items).toHaveLength(3);
    expect(snapshot.items.some((item) => item.baseUrl === 'https://three.odoo.test')).toBe(true);

    const second = snapshot.items.find((item) => item.baseUrl === 'https://two.odoo.test');
    snapshot = setDefaultInstance(config, second.id);
    expect(snapshot.defaultInstanceId).toBe(second.id);
    expect(snapshot.defaultBaseUrl).toBe('https://two.odoo.test');

    config = resolveInstancesConfig({
      instances: snapshot.items,
      defaultInstanceId: snapshot.defaultInstanceId,
      baseUrl: snapshot.defaultBaseUrl,
    });

    snapshot = updateInstance(config, second.id, {
      label: 'Segunda',
      url: 'https://updated.odoo.test',
    });
    expect(snapshot.items.find((item) => item.id === second.id).label).toBe('Segunda');

    config = resolveInstancesConfig({
      instances: snapshot.items,
      defaultInstanceId: snapshot.defaultInstanceId,
      baseUrl: snapshot.defaultBaseUrl,
    });

    const remaining = snapshot.items.find((item) => item.id !== second.id);
    snapshot = removeInstance(config, second.id);
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.defaultInstanceId).toBe(remaining.id);
  });
});
