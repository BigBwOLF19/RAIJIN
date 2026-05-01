const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('Raijin.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously' });
dom.window.addEventListener('error', (e) => {
  console.log('RUNTIME ERROR:', e.error || e.message);
});
setTimeout(() => {
  console.log('JSDOM test complete.');
  process.exit(0);
}, 2000);
