const ODOO_DEBUG_DOUBLE_PRESS_MS = 450;
const ODOO_DEBUG_DEDUP_MS = 200;

let lastOdooDebugPressAt = 0;
let lastOdooDebugHandledAt = 0;

function resolveOdooDebugLevelFromShortcut() {
  const now = Date.now();
  const isDouble = lastOdooDebugPressAt > 0 && now - lastOdooDebugPressAt < ODOO_DEBUG_DOUBLE_PRESS_MS;
  lastOdooDebugPressAt = now;
  return isDouble ? 'assets' : '1';
}

function consumeOdooDebugLevelFromShortcut() {
  const now = Date.now();
  if (now - lastOdooDebugHandledAt < ODOO_DEBUG_DEDUP_MS) {
    return null;
  }
  lastOdooDebugHandledAt = now;
  return resolveOdooDebugLevelFromShortcut();
}

function resetOdooDebugShortcutState() {
  lastOdooDebugPressAt = 0;
  lastOdooDebugHandledAt = 0;
}

module.exports = {
  ODOO_DEBUG_DOUBLE_PRESS_MS,
  ODOO_DEBUG_DEDUP_MS,
  resolveOdooDebugLevelFromShortcut,
  consumeOdooDebugLevelFromShortcut,
  resetOdooDebugShortcutState,
};
