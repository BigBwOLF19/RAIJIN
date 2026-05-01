const fs = require('fs');

let html = fs.readFileSync('Raijin.html', 'utf8');

// 1. Fix missing brace in the Javascript
const scriptIdx = html.indexOf('</script>');
if (scriptIdx !== -1) {
  const jsPart = html.substring(html.indexOf('<script>'), scriptIdx);
  const openCount = (jsPart.match(/\{/g) || []).length;
  const closeCount = (jsPart.match(/\}/g) || []).length;
  if (openCount > closeCount) {
    html = html.substring(0, scriptIdx) + '\n    }\n  ' + html.substring(scriptIdx);
    console.log('Fixed missing closing brace in JS.');
  }
}

// 2. CSS Changes
// Make body non-scrolling
html = html.replace(/min-height:\s*100vh;\s*overflow-x:\s*hidden;/g, 'height: 100vh; overflow: hidden; display: flex; flex-direction: column;');

// Hide scroll-veil
html = html.replace(/#scroll-veil\s*\{[\s\S]*?\}/g, '#scroll-veil { display: none; }');

// Add new UI classes
const extraCss = `
  /* SCREENS */
  .screen {
    position: absolute; top: 80px; left: 0; width: 100%; height: calc(100vh - 80px);
    opacity: 0; pointer-events: none; transform: scale(0.95);
    transition: opacity 0.5s ease, transform 0.5s ease, filter 0.5s ease;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    overflow-y: auto; overflow-x: hidden;
  }
  .screen.active { opacity: 1; pointer-events: auto; transform: scale(1); }
  .screen-content { padding: 4rem 2rem; width: 100%; max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; }
  .hero .screen-content { justify-content: center; min-height: 100%; }

  /* SHARD BUTTONS */
  .btn-shard {
    position: relative; padding: 1rem 3rem; color: var(--white);
    font-family: 'Orbitron', sans-serif; font-size: 0.85rem; font-weight: 900;
    letter-spacing: 0.15em; text-transform: uppercase; background: transparent; border: none; cursor: pointer;
    clip-path: polygon(15% 0, 100% 0, 85% 100%, 0 100%);
    transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
    display: inline-flex; align-items: center; justify-content: center; margin: 0.5rem;
  }
  .btn-shard::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, var(--purple-glow), var(--cyan-accent)); z-index: -2; }
  .btn-shard::after { content: ''; position: absolute; inset: 2px; background: var(--grey-800); clip-path: polygon(15% 0, 100% 0, 85% 100%, 0 100%); z-index: -1; transition: background 0.3s, inset 0.3s; }
  .btn-shard:hover { transform: scale(1.05) translateX(4px); text-shadow: 0 0 12px var(--cyan-accent); }
  .btn-shard:hover::after { background: rgba(108,63,255,0.15); inset: 1px; }
  .btn-shard-solid::after { background: linear-gradient(135deg, var(--purple-glow), rgba(103,232,249,0.3)); }
  .btn-shard-solid:hover::after { background: linear-gradient(135deg, var(--purple-bright), var(--cyan-accent)); }
  .btn-rune { clip-path: polygon(0 15%, 100% 0, 100% 85%, 0 100%); }
  .btn-rune::after { clip-path: polygon(0 15%, 100% 0, 100% 85%, 0 100%); }
  .screen-nav { display: flex; gap: 1.5rem; justify-content: center; margin-top: 3rem; padding-bottom: 3rem; width: 100%; }
`;
if (!html.includes('.btn-shard')) {
  html = html.replace('</style>', extraCss + '\n  </style>');
}

// 3. HTML Changes
// Remove nav links
html = html.replace(/<div class="nav-links">[\s\S]*?<\/div>/g, '');

// Transform <section class="hero"> to screen
if (!html.includes('class="screen active hero"')) {
  html = html.replace(/<section class="hero">/g, '<div class="screen active hero" id="screen-hero"><div class="screen-content">');
  html = html.replace(/<\/section>\s*<div class="section-divider"><\/div>/g, '</div></div>');
  html = html.replace(/<div class="hero-cta">[\s\S]*?<\/div>/, `<div class="hero-cta">
        <button class="btn-shard btn-shard-solid" onclick="openRiddle()">SUMMON RAIJIN ⚡</button>
        <button class="btn-shard" onclick="switchScreen('abilities')">VIEW ABILITIES</button>
      </div>`);
}

// Transform chat section
if (!html.includes('class="screen chat-section"')) {
  html = html.replace(/<section class="chat-section.*?id="chat">/g, '<div class="screen chat-section" id="screen-chat"><div class="screen-content">');
  html = html.replace(/<\/section>\s*<div class="section-divider"><\/div>/g, `<div class="screen-nav">
        <button class="btn-shard btn-rune" onclick="switchScreen('abilities')">POWER MATRIX</button>
        <button class="btn-shard" onclick="switchScreen('hero')">DISCONNECT</button>
      </div>
    </div></div>`);
}

// Transform abilities section
if (!html.includes('class="screen abilities-section"')) {
  html = html.replace(/<section class="abilities-section" id="abilities">/g, '<div class="screen abilities-section" id="screen-abilities"><div class="screen-content">');
  html = html.replace(/<\/section>/g, `<div class="screen-nav">
        <button class="btn-shard btn-shard-solid" onclick="switchScreen('chat')">NEURAL LINK ⚡</button>
        <button class="btn-shard btn-rune" onclick="switchScreen('hero')">MAIN CORE</button>
      </div>
    </div></div>`);
}

// Update Riddle Buttons
html = html.replace(/<button class="btn-secondary" onclick="closeRiddle\(\)">CANCEL<\/button>\s*<button class="btn-primary" onclick="checkRiddle\(\)">OPEN GATE ⚡<\/button>/g, `<button class="btn-shard btn-rune" onclick="closeRiddle()">CANCEL</button>
        <button class="btn-shard btn-shard-solid" onclick="checkRiddle()">OPEN GATE ⚡</button>`);

// Update Level Up Button
html = html.replace(/<button class="btn-primary" onclick="closeLevelUp\(\)">CONTINUE ⚡<\/button>/g, '<button class="btn-shard btn-shard-solid" onclick="closeLevelUp()">CONTINUE ⚡</button>');


// 4. Javascript logic updates
// Replace scroll blur with setBackgroundState
const viewManagerJS = `// ===================== SCREEN MANAGER =====================
    function setBackgroundState(screenId) {
      if (screenId === 'hero') {
        canvas.style.filter = 'blur(0px) saturate(1.25) brightness(1.08)';
        canvas.style.opacity = '0.55';
        foregroundCanvas.style.opacity = '0.92';
        foregroundCanvas.style.filter = 'brightness(1.12)';
        stormIntensity = 1;
        heroBoltsActive = true;
      } else {
        canvas.style.filter = 'blur(14px) saturate(1.5) brightness(1.2)';
        canvas.style.opacity = '0.35';
        foregroundCanvas.style.opacity = '0';
        stormIntensity = 0.55;
        heroBoltsActive = true;
      }
    }

    function switchScreen(screenId) {
      document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
      const target = document.getElementById('screen-' + screenId);
      if(target) target.classList.add('active');
      setBackgroundState(screenId);
      if (screenId === 'chat') {
        setTimeout(() => document.getElementById('chat-input').focus(), 600);
      }
    }`;

if (!html.includes('function setBackgroundState')) {
  // Try to replace the scroll veil listener
  html = html.replace(/\/\/ ===================== SCROLL BLUR =====================[\s\S]*?\{passive:\s*true\}\);/g, viewManagerJS);
}

// Fix makeScreenBolt so it keeps drawing blurred bolts when not on hero screen
html = html.replace(/if\s*\(\(!heroBoltsActive \|\| chatUnlocked\) && kind !== 'summon'\)\s*return;/g, "if (!heroBoltsActive && kind !== 'summon') return;");
html = html.replace(/if\s*\(!b.foreground \|\| !heroBoltsActive \|\| chatUnlocked\)\s*return;/g, "if (!b.foreground || !heroBoltsActive) return;");

// Fix revealChat to use switchScreen
html = html.replace(/function revealChat\(\)\s*\{[\s\S]*?setTimeout\(\(\)=>chatInput\.focus\(\),\s*950\);\s*\}/g, `function revealChat() {
      chatUnlocked = true;
      switchScreen('chat');
    }`);

fs.writeFileSync('Raijin.html', html, 'utf8');
console.log('Successfully updated Raijin.html with UI enhancements!');
