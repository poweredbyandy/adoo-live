const fs = require('fs');
const path = require('path');

const bindingGyp = path.join(__dirname, '../node_modules/usb/binding.gyp');

if (!fs.existsSync(bindingGyp)) {
  process.exit(0);
}

const content = fs.readFileSync(bindingGyp, 'utf8');
if (!content.includes('-std=c++14')) {
  process.exit(0);
}

fs.writeFileSync(bindingGyp, content.replace(/-std=c\+\+14/g, '-std=c++17'));
