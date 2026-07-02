const {
  W,
  buildEscpCommandTestLines,
  buildEscpCommandTestPayload,
  buildEscpCommandTestPreviewPayload,
} = require('./escp-command-test-page');

function buildLx300ReferenceLines() {
  return buildEscpCommandTestLines();
}

function buildLx300ReferencePayload() {
  return buildEscpCommandTestPayload();
}

function buildLx300ReferencePreviewPayload() {
  return buildEscpCommandTestPreviewPayload();
}

module.exports = {
  W,
  buildLx300ReferenceLines,
  buildLx300ReferencePayload,
  buildLx300ReferencePreviewPayload,
};
