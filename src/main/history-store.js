const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MAX_PAGE_HISTORY = 200;
const MAX_RECENT_INSTANCES = 20;
const MAX_DOWNLOADS = 100;

function extractInstance(urlString) {
  try {
    const url = new URL(urlString);
    if (!url.protocol.startsWith('http')) {
      return null;
    }
    return {
      origin: url.origin,
      host: url.hostname,
      label: url.host,
      baseUrl: url.origin,
    };
  } catch {
    return null;
  }
}

class HistoryStore {
  constructor() {
    this.pageHistory = [];
    this.recentInstances = [];
    this.downloads = [];
    this.filePath = null;
  }

  init() {
    this.filePath = path.join(app.getPath('userData'), 'browser-history.json');
    this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      this.pageHistory = Array.isArray(data.pageHistory) ? data.pageHistory : [];
      this.recentInstances = Array.isArray(data.recentInstances) ? data.recentInstances : [];
      this.downloads = Array.isArray(data.downloads) ? data.downloads : [];
    } catch {
      this.pageHistory = [];
      this.recentInstances = [];
      this.downloads = [];
    }
  }

  save() {
    if (!this.filePath) {
      return;
    }
    fs.writeFileSync(
      this.filePath,
      JSON.stringify(
        {
          pageHistory: this.pageHistory,
          recentInstances: this.recentInstances,
          downloads: this.downloads,
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  addPageVisit(url, title = '') {
    const instance = extractInstance(url);
    if (!instance) {
      return;
    }
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url,
      title: title || url,
      host: instance.host,
      visitedAt: new Date().toISOString(),
    };
    this.pageHistory = [entry, ...this.pageHistory.filter((item) => item.url !== url)].slice(0, MAX_PAGE_HISTORY);
    this.addRecentInstance(url);
    this.save();
  }

  addRecentInstance(url) {
    const instance = extractInstance(url);
    if (!instance) {
      return;
    }
    const entry = {
      ...instance,
      lastVisitedAt: new Date().toISOString(),
    };
    this.recentInstances = [
      entry,
      ...this.recentInstances.filter((item) => item.origin !== instance.origin),
    ].slice(0, MAX_RECENT_INSTANCES);
    this.save();
  }

  addDownload(item) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filename: item.filename,
      path: item.path || '',
      url: item.url || '',
      state: item.state || 'started',
      startedAt: new Date().toISOString(),
      completedAt: item.completedAt || null,
    };
    this.downloads = [entry, ...this.downloads].slice(0, MAX_DOWNLOADS);
    this.save();
    return entry;
  }

  updateDownload(id, patch) {
    const index = this.downloads.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }
    this.downloads[index] = { ...this.downloads[index], ...patch };
    this.save();
    return this.downloads[index];
  }

  clearPageHistory() {
    this.pageHistory = [];
    this.save();
  }

  getSnapshot() {
    return {
      pageHistory: [...this.pageHistory],
      recentInstances: [...this.recentInstances],
      downloads: [...this.downloads],
    };
  }
}

const historyStore = new HistoryStore();

module.exports = { HistoryStore, historyStore, extractInstance };
