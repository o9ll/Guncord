const fs = require('fs');
const b64 = fs.readFileSync('browser.jpg').toString('base64');
fs.mkdirSync('../src/guncordplugins/privateBrowser/components', { recursive: true });
fs.writeFileSync('../src/guncordplugins/privateBrowser/icon.ts', 'export const browserBase64 = "' + b64 + '";');
