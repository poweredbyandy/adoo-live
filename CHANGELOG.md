# Changelog

All notable changes to adoo IoT are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [1.0.0-beta.1]

### Added

- Shell UI with home instances, settings modal, permissions, and download history.
- Click-tour tests for interactive controls.
- GitHub Actions release pipeline (macOS, Linux, Windows).

### Changed

- Menu as a right-anchored popover instead of a full-height drawer.

### Fixed

- Home page instance actions (edit/delete) without `window.prompt()` in Electron.
- Shell tour tests no longer fetch CSS over the network in CI.
