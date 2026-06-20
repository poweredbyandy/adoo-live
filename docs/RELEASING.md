# Guía de releases y changelog automático

Este proyecto genera el **changelog del release** y actualiza `CHANGELOG.md` en `main` automáticamente cuando publicas un tag `v*`.

## Resumen del flujo

1. Haces commits con el formato correcto (ver abajo).
2. Opcional: anotas bullets en `CHANGELOG.md` bajo `[Unreleased]`.
3. Creas y subes el tag: `git tag v1.0.0-beta.2 && git push origin v1.0.0-beta.2`.
4. GitHub Actions:
   - ejecuta tests y construye binarios (macOS, Linux, Windows);
   - genera la sección `## [versión]` en `CHANGELOG.md` desde los commits;
   - publica el release con ese texto + notas automáticas de GitHub (PRs);
   - hace commit de `CHANGELOG.md` en `main`.

No necesitas escribir el release en GitHub manualmente.

## Formato de commits (obligatorio para clasificación)

Usa el mismo estilo que en Odoo:

```text
[TAG] modulo: descripción corta en una línea
```

### Ejemplos que se detectan bien

```text
[ADD] odoo-kiosk: add download history panel
[FIX] shell: repair home instance edit flow
[IMP] ui: redesign menu as right popover
[REF] ipc: simplify permission handlers
[FIX] window-manager: detach menu overlay on close
[I18N] locales: add Spanish strings for settings
```

En el changelog aparecerá como:

- `odoo-kiosk: add download history panel` → sección **Added**
- `shell: repair home instance edit flow` → sección **Fixed**

### Mapa de tags → sección del changelog

| Tag en el commit | Sección en `CHANGELOG.md` |
|----------------|---------------------------|
| `[ADD]` | Added |
| `[FIX]` | Fixed |
| `[IMP]` | Changed |
| `[REF]` | Changed |
| `[PERF]` | Changed |
| `[MOV]` | Changed |
| `[REM]` | Removed |
| `[REV]` | Removed |
| `[I18N]` | Translations |
| Otro tag reconocido | Other |
| Sin tag `[...]` | Other |

### Commits que **no** entran al changelog

| Caso | Por qué |
|------|---------|
| `[REL] ...` | Son commits de release/changelog |
| `[MERGE]`, `[CLA]`, `[CLN]`, `[LINT]` | Mantenimiento interno |
| `Release v1.0.0...` | Mensaje de release manual |
| Merge commits | Se omiten con `--no-merges` |

## Entrada manual opcional (`[Unreleased]`)

Si quieres añadir algo que no sale bien del mensaje de commit, edita `CHANGELOG.md`:

```markdown
## [Unreleased]

### Added

- Soporte para impresoras USB en modo kiosk.

### Fixed

```

Al publicar el tag, esos bullets se fusionan en la sección **Added** de la versión y `[Unreleased]` se vacía.

## Publicar una versión

### 1. Versión en `package.json`

```json
"version": "1.0.0-beta.2"
```

### 2. Commit en `main`

```bash
git add package.json
git commit -m "[REL] odoo-kiosk: prepare release v1.0.0-beta.2"
git push origin main
```

### 3. Tag y push

```bash
git tag v1.0.0-beta.2
git push origin v1.0.0-beta.2
```

El tag debe coincidir con la versión (`v` + número de `package.json`).

### 4. Verificar

- Actions → workflow **Release**
- Repositorio → **Releases** → texto y binarios
- `main` → `CHANGELOG.md` actualizado por el bot

## Comandos locales

Vista previa del changelog de una versión (sin modificar archivos):

```bash
npm run changelog:preview -- 1.0.0-beta.2
```

Generar/actualizar `CHANGELOG.md` localmente:

```bash
npm run changelog:sync -- 1.0.0-beta.2
```

Útil para revisar antes de crear el tag.

## Pre-releases

Tags con guion (ej. `v1.0.0-beta.2`) se publican como **pre-release** en GitHub.

## Buenas prácticas

1. Un cambio lógico = un commit con un tag claro (`[FIX]`, `[ADD]`, `[IMP]`).
2. Descripción en inglés o español, pero **siempre** con `modulo: descripción`.
3. No mezclar varios temas en un solo commit si quieres un changelog legible.
4. Usa `[Unreleased]` solo para notas que no están en el mensaje del commit.

## Archivos relacionados

| Archivo | Función |
|---------|---------|
| `CHANGELOG.md` | Historial público (auto + manual) |
| `scripts/lib/changelog-from-git.js` | Parseo y clasificación de commits |
| `scripts/sync-changelog.js` | Actualiza `CHANGELOG.md` |
| `scripts/release-notes.js` | Texto del release en GitHub |
| `.github/workflows/release.yml` | Pipeline de build y publicación |
