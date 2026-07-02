const W = 80;

function padLine(value) {
  return String(value || '').replace(/\n/g, ' ').slice(0, W);
}

function rulerLine() {
  let line = '|';
  for (let decade = 0; decade < 8; decade += 1) {
    line += '....+....';
    line += String(decade + 1);
  }
  return padLine(`${line}|`);
}

function buildEscpCommandTestLines() {
  const lines = [];
  const push = (line) => {
    lines.push(padLine(line));
  };

  push('PAGINA PRUEBA ESC/P - TODOS LOS COMANDOS');
  push('Impresora ref: Epson LX-300+II | Carta 8.5x11 | 80 cols @ 10 CPI');
  push(rulerLine());
  push('');

  push('01 RESET ESC @');
  push('\x1b@Texto tras reinicio (ESC @)');
  push('');

  push('02 PICA 10 CPI (ESC P)');
  push(`\x1bP${'0123456789'.repeat(8)}`);
  push('');

  push('03 ELITE 12 CPI (ESC M)');
  push(`\x1bM${'abcdefghijkl'.repeat(6)}abcd`);
  push('');

  push('04 QUINCE CPI (ESC g 1)');
  push(`\x1bP\x1bg\x01${'X'.repeat(60)}`);
  push('');

  push('05 FUENTES ESC k');
  push(`\x1b\x6b\x00${'Roman k=0 bitmap'}`);
  push(`\x1b\x6b\x01${'Sans k=1 bitmap'}`);
  push(`\x1b\x6b\x02${'Courier k=2 monoespaciada'}`);
  push(`\x1b\x6b\x00${'Vuelta Roman k=0'}`);
  push('');

  push('06 CALIDAD ESC x');
  push(`\x1b\x78\x01${'LQ x1 mas definido'}`);
  push(`\x1b\x78\x00${'Draft x0 mas rapido'}`);
  push('');

  push('07 PAGINA CARACTERES ESC t');
  push(`\x1b\x74\x00${'PC437 t=0'} \x1b\x74\x13${'CP858 t=19 euro'}`);
  push(`\x1b\x74\x00${'Vuelta PC437 t=0'}`);
  push('');

  push('08 JUEGO INTERNACIONAL ESC R');
  push(`\x1b\x52\x00${'USA R=0'}`);
  push(`\x1b\x52\x06${'Espana II R=6'}`);
  push(`\x1b\x52\x00${'Vuelta USA R=0'}`);
  push('');

  push('09 CONDENSADO SI / DC2');
  push(`\x0f${'Linea condensada 17 CPI en la misma linea fisica.'}`);
  push('\x12Linea normal tras DC2.');
  push('');

  push('10 NEGRITA ESC E / ESC F');
  push(`\x1bE\x01NEGRITA\x1bF normal`);
  push('');

  push('11 DOBLE IMPACTO ESC G / ESC H');
  push(`\x1bG${'Doble golpe'}\x1bH normal`);
  push('');

  push('12 SUBRAYADO ESC -');
  push(`\x1b-\x01subrayado\x1b-\x00 normal`);
  push('');

  push('13 CURSIVA ESC 4 / ESC 5');
  push(`\x1b4cursiva\x1b5 normal`);
  push('');

  push('14 ANCHO DOBLE ESC W');
  push(`\x1bW\x01ANCHO\x1bW\x00\x1bP pica`);
  push('');

  push('15 COMBINADO NEGRITA+SUBRAYADO+CURSIVA');
  push(`\x1bE\x01\x1b-\x01\x1b4combo\x1b5\x1b-\x00\x1bF normal`);
  push('');

  push('16 INTERLINEADO 1/6 (ESC 2) y 1/8 (ESC 0)');
  push(`\x1b2${'Seis LPI  '}\x1b0${'Ocho LPI'}\x1b2${' otra vez seis LPI'}`);
  push('');

  push('17 AVANCE ESC d y ESC J');
  push('Linea antes del feed');
  push(`\x1bd\x02Linea tras ESC d 2`);
  push(`\x1bJ\x18Linea tras ESC J (24 unidades)`);
  push('');

  push('18 LATIN-1 y simbolos');
  push('nino nina cafe union; simbolos 0-9 #%=+-|');
  push(`\x1bE\x01${'Negrita en ref x3.5'}\x1bF`);
  push(`${'-'.repeat(40)}${'='.repeat(40)}`);
  push('FIN PAGINA 1');

  return lines;
}

function buildEscpCommandTestPageTwoLines() {
  return [
    padLine('PAGINA 2 - FORM FEED (FF)'),
    padLine('Verifica salto de pagina y reinicio visual en preview'),
    padLine(rulerLine()),
    padLine(`\x1bP${'Z'.repeat(80)}`),
    padLine('FIN PAGINA 2'),
  ];
}

function buildEscpCommandTestPayload() {
  const nl = '\r\n';
  const pageOne = buildEscpCommandTestLines();
  const pageTwo = buildEscpCommandTestPageTwoLines();
  const init = '\x1b@';
  const body = pageOne.join(nl) + nl + '\x0c' + init + pageTwo.join(nl) + nl;
  const tail = '\x1bF\x1b-\x00\x1b5\x1bP\x1b2' + nl + nl;
  return Buffer.from(init + body + tail, 'latin1');
}

function buildEscpCommandTestPreviewPayload() {
  const bytes = buildEscpCommandTestPayload();
  return {
    printer_uid: '',
    document: bytes.toString('base64'),
    document_name: 'escp-command-test.bin',
    mime_type: 'application/vnd.pba.kiosk.esc-p',
    print_format: 'esc_p',
    encoding: 'binary',
    command_set: 'esc_p_epson',
    job_name: 'ESC/P command test page',
    print_uid: `escp-test-${Date.now()}`,
  };
}

const ESCP_COMMAND_TEST_SECTIONS = [
  'RESET ESC @',
  'PICA 10 CPI',
  'ELITE 12 CPI',
  'QUINCE CPI',
  'FUENTES ESC k',
  'CALIDAD ESC x',
  'PAGINA CARACTERES ESC t',
  'JUEGO INTERNACIONAL ESC R',
  'CONDENSADO SI / DC2',
  'NEGRITA ESC E / ESC F',
  'DOBLE IMPACTO ESC G / ESC H',
  'SUBRAYADO ESC -',
  'CURSIVA ESC 4 / ESC 5',
  'ANCHO DOBLE ESC W',
  'COMBINADO',
  'INTERLINEADO',
  'AVANCE ESC d',
  'LATIN-1',
  'FORM FEED',
];

module.exports = {
  W,
  ESCP_COMMAND_TEST_SECTIONS,
  buildEscpCommandTestLines,
  buildEscpCommandTestPageTwoLines,
  buildEscpCommandTestPayload,
  buildEscpCommandTestPreviewPayload,
  padLine,
  rulerLine,
};
