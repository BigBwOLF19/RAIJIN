
    // The browser sends chat requests to the local proxy server.
    // Run server.js with ANTHROPIC_API_KEY set in the server environment.

    // ===================== STORM CANVAS =====================
    const canvas = document.getElementById('storm-canvas');
    const ctx = canvas.getContext('2d');
    const foregroundCanvas = document.getElementById('storm-foreground-canvas');
    const fgCtx = foregroundCanvas.getContext('2d');
    let W, H;
    let stormIntensity = 1;
    function resizeCanvas() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      foregroundCanvas.width = W;
      foregroundCanvas.height = H;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Floating particles
    const particles = [];
    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * 2000, y: Math.random() * 1200,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 2.2 + 0.4, a: Math.random() * 0.7 + 0.25,
        depth: Math.random() * 0.8 + 0.4
      });
    }

    // Hero-only long lightning strikes.
    const bolts = [];
    let heroBoltsActive = true;

    function createBoltPath(kind = 'main') {
      const margin = Math.max(W, H) * 0.18;
      const patterns = kind === 'summon'
        ? ['corner-fall', 'sky-split', 'diagonal']
        : ['side-sweep', 'diagonal', 'reverse-diagonal', 'sky-split', 'ground-rise', 'corner-fall', 'corner-rise', 'vertical-rift', 'arc'];
      const pattern = kind === 'diagonal'
        ? (Math.random() > 0.5 ? 'diagonal' : 'reverse-diagonal')
        : patterns[Math.floor(Math.random() * patterns.length)];

      let start, end, curve = 0;
      const edgePoint = edge => {
        if (edge === 'top') return { x: W * (0.08 + Math.random() * 0.84), y: -margin };
        if (edge === 'bottom') return { x: W * (0.08 + Math.random() * 0.84), y: H + margin };
        if (edge === 'left') return { x: -margin, y: H * (0.08 + Math.random() * 0.78) };
        return { x: W + margin, y: H * (0.08 + Math.random() * 0.78) };
      };

      switch (pattern) {
        case 'side-sweep':
          start = edgePoint(Math.random() > 0.5 ? 'left' : 'right');
          end = edgePoint(start.x < 0 ? 'right' : 'left');
          curve = (Math.random() - 0.5) * H * 0.2;
          break;
        case 'diagonal':
          start = Math.random() > 0.5 ? { x: -margin, y: -margin * 0.45 } : { x: W * 0.15, y: -margin };
          end = Math.random() > 0.5 ? { x: W + margin, y: H + margin * 0.35 } : { x: W + margin * 0.2, y: H + margin };
          curve = H * (0.05 + Math.random() * 0.18);
          break;
        case 'reverse-diagonal':
          start = Math.random() > 0.5 ? { x: W + margin, y: -margin * 0.45 } : { x: W * 0.85, y: -margin };
          end = Math.random() > 0.5 ? { x: -margin, y: H + margin * 0.35 } : { x: W * 0.12, y: H + margin };
          curve = -H * (0.05 + Math.random() * 0.18);
          break;
        case 'sky-split':
          start = edgePoint('top');
          end = { x: Math.max(-margin, Math.min(W + margin, start.x + (Math.random() - 0.5) * W * 0.45)), y: H + margin };
          curve = (Math.random() - 0.5) * W * 0.08;
          break;
        case 'ground-rise':
          start = edgePoint('bottom');
          end = { x: Math.max(-margin, Math.min(W + margin, start.x + (Math.random() - 0.5) * W * 0.5)), y: -margin };
          curve = (Math.random() - 0.5) * W * 0.08;
          break;
        case 'corner-fall':
          start = Math.random() > 0.5 ? { x: -margin, y: -margin } : { x: W + margin, y: -margin };
          end = { x: W * (0.18 + Math.random() * 0.64), y: H + margin };
          curve = (start.x < 0 ? 1 : -1) * H * (0.1 + Math.random() * 0.16);
          break;
        case 'corner-rise':
          start = Math.random() > 0.5 ? { x: -margin, y: H + margin } : { x: W + margin, y: H + margin };
          end = { x: W * (0.18 + Math.random() * 0.64), y: -margin };
          curve = (start.x < 0 ? -1 : 1) * H * (0.1 + Math.random() * 0.16);
          break;
        case 'vertical-rift':
          start = { x: W * (0.28 + Math.random() * 0.44), y: -margin };
          end = { x: Math.max(-margin, Math.min(W + margin, start.x + (Math.random() - 0.5) * W * 0.22)), y: H + margin };
          curve = (Math.random() - 0.5) * W * 0.1;
          break;
        default:
          start = edgePoint(Math.random() > 0.5 ? 'left' : 'right');
          end = edgePoint(Math.random() > 0.5 ? 'top' : 'bottom');
          curve = (Math.random() - 0.5) * Math.max(W, H) * 0.18;
      }

      const points = [];
      const segments = kind === 'main' || kind === 'summon' ? 18 : 13;
      const sway = (kind === 'main' || kind === 'summon') ? Math.max(W, H) * 0.09 : Math.max(W, H) * 0.06;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const baseX = start.x + (end.x - start.x) * t;
        const baseY = start.y + (end.y - start.y) * t;
        const normalX = -(end.y - start.y);
        const normalY = end.x - start.x;
        const normalLen = Math.hypot(normalX, normalY) || 1;
        const bow = Math.sin(t * Math.PI) * curve;
        const jitter = Math.sin(t * Math.PI) * sway;
        points.push({
          x: baseX + (normalX / normalLen) * bow + (Math.random() - 0.5) * jitter,
          y: baseY + (normalY / normalLen) * bow + (Math.random() - 0.5) * jitter,
          branch: i > 2 && i < segments - 2 && Math.random() < (kind === 'main' || kind === 'summon' ? 0.4 : 0.24)
        });
      }
      return points;
    }

    function makeScreenBolt(kind = 'main') {
      if (!heroBoltsActive && kind !== 'summon') return;
      bolts.push({
        points: createBoltPath(kind),
        life: 1,
        decay: kind === 'main' ? 0.032 : 0.045,
        width: kind === 'main' ? 2.5 + Math.random() * 1.7 : 1.5 + Math.random() * 1.2,
        depth: kind === 'main' ? 1.2 + Math.random() * 0.45 : 0.85 + Math.random() * 0.35,
        flash: kind === 'main' ? 0.22 : 0.12,
        foreground: kind !== 'summon' && Math.random() < 0.42,
        color: Math.random() < 0.45 ? [103, 232, 249] : [184, 117, 255]
      });
    }

    for (let i = 0; i < 2; i++) setTimeout(() => makeScreenBolt('main'), 450 + i * 900);
    setInterval(() => {
      if (!heroBoltsActive) return;
      if (Math.random() < 0.42) makeScreenBolt('main');
      if (Math.random() < 0.23) setTimeout(() => makeScreenBolt(Math.random() > 0.5 ? 'diagonal' : 'main'), 110 + Math.random() * 260);
    }, 1200);

    function drawScreenBolt(b) {
      const alpha = Math.pow(Math.max(0, b.life), 1.6) * stormIntensity;
      const drawPath = (offsetX, offsetY, width, opacity, blur, stroke) => {
        ctx.globalAlpha = alpha * opacity;
        ctx.lineWidth = width * b.width * b.depth;
        ctx.strokeStyle = stroke;
        ctx.shadowColor = `rgb(${b.color[0]},${b.color[1]},${b.color[2]})`;
        ctx.shadowBlur = blur * b.depth * Math.max(0.2, b.life);
        ctx.beginPath();
        ctx.moveTo(b.points[0].x + offsetX, b.points[0].y + offsetY);
        for (let i = 1; i < b.points.length; i++) {
          const p = b.points[i];
          ctx.lineTo(p.x + offsetX, p.y + offsetY);
          if (p.branch) {
            const prev = b.points[i - 1];
            const angle = Math.atan2(p.y - prev.y, p.x - prev.x) + (Math.random() > 0.5 ? 1 : -1) * (0.7 + Math.random() * 0.45);
            const len = (W * 0.08 + Math.random() * W * 0.08) * b.depth;
            ctx.moveTo(p.x + offsetX, p.y + offsetY);
            ctx.lineTo(p.x + Math.cos(angle) * len + offsetX, p.y + Math.sin(angle) * len + offsetY);
            ctx.moveTo(p.x + offsetX, p.y + offsetY);
          }
        }
        ctx.stroke();
      };

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawPath(12 * b.depth, 16 * b.depth, 8.5, 0.12, 34, `rgba(${b.color[0]},${b.color[1]},${b.color[2]},0.9)`);
      drawPath(-5 * b.depth, -6 * b.depth, 4.6, 0.28, 22, `rgba(75,35,165,0.95)`);
      drawPath(0, 0, 1.5, 0.95, 14, `rgb(${b.color[0]},${b.color[1]},${b.color[2]})`);
      drawPath(-1.5 * b.depth, -1.5 * b.depth, 0.55, 1.0, 5, 'rgb(255,255,255)');
      if (heroBoltsActive && b.flash > 0) {
        ctx.globalAlpha = alpha * b.flash;
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(230,245,255,0.32)';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }

    function drawForegroundBolt(b) {
      if (!b.foreground || !heroBoltsActive) return;
      const alpha = Math.pow(Math.max(0, b.life), 1.35) * Math.min(1.35, stormIntensity + 0.25);
      const drawPath = (offsetX, offsetY, width, opacity, blur, stroke) => {
        fgCtx.globalAlpha = alpha * opacity;
        fgCtx.lineWidth = width * b.width * b.depth;
        fgCtx.strokeStyle = stroke;
        fgCtx.shadowColor = `rgb(${b.color[0]},${b.color[1]},${b.color[2]})`;
        fgCtx.shadowBlur = blur * b.depth * Math.max(0.25, b.life);
        fgCtx.beginPath();
        fgCtx.moveTo(b.points[0].x + offsetX, b.points[0].y + offsetY);
        for (let i = 1; i < b.points.length; i++) {
          const p = b.points[i];
          fgCtx.lineTo(p.x + offsetX, p.y + offsetY);
          if (p.branch) {
            const prev = b.points[i - 1];
            const angle = Math.atan2(p.y - prev.y, p.x - prev.x) + (Math.random() > 0.5 ? 1 : -1) * (0.65 + Math.random() * 0.35);
            const len = (W * 0.06 + Math.random() * W * 0.06) * b.depth;
            fgCtx.moveTo(p.x + offsetX, p.y + offsetY);
            fgCtx.lineTo(p.x + Math.cos(angle) * len + offsetX, p.y + Math.sin(angle) * len + offsetY);
            fgCtx.moveTo(p.x + offsetX, p.y + offsetY);
          }
        }
        fgCtx.stroke();
      };

      fgCtx.save();
      fgCtx.lineCap = 'round';
      fgCtx.lineJoin = 'round';
      drawPath(0, 0, 5.8, 0.34, 30, `rgba(${b.color[0]},${b.color[1]},${b.color[2]},0.78)`);
      drawPath(0, 0, 2.9, 0.88, 18, `rgb(${b.color[0]},${b.color[1]},${b.color[2]})`);
      drawPath(-1.2 * b.depth, -1.2 * b.depth, 1.05, 1.0, 8, 'rgb(255,255,255)');
      fgCtx.globalAlpha = alpha * 0.16;
      fgCtx.shadowBlur = 0;
      fgCtx.fillStyle = 'rgba(235,248,255,0.42)';
      fgCtx.fillRect(0, 0, W, H);
      fgCtx.restore();
    }

    function drawGrid() {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(108,63,255,0.06)';
      ctx.lineWidth = 0.5;
      const sp = 60;
      for (let x = 0; x < W; x += sp) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += sp) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    }

    function animate() {
      ctx.clearRect(0, 0, W, H);
      fgCtx.clearRect(0, 0, W, H);
      drawGrid();
      // particles
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168,85,247,${p.a * 0.48 * stormIntensity})`;
        ctx.shadowColor = 'rgba(103,232,249,0.45)';
        ctx.shadowBlur = 6 * p.depth;
        ctx.fill();
      });
      // long screen bolts on the hero, blurred ambience after summoning
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        drawScreenBolt(b);
        drawForegroundBolt(b);
        b.life -= b.decay;
        if (b.life <= 0) bolts.splice(i, 1);
      }
      requestAnimationFrame(animate);
    }

    // animate(); // MOVED TO BOTTOM

    // ===================== SCREEN MANAGER =====================
    function setBackgroundState(screenId) {
      if (screenId === 'hero') {
        canvas.style.filter = `blur(0px) saturate(1.25) brightness(1.08)`;
        canvas.style.opacity = `0.55`;
        foregroundCanvas.style.opacity = `0.92`;
        foregroundCanvas.style.filter = `brightness(1.12)`;
        stormIntensity = 1;
        heroBoltsActive = true;
      } else {
        // Persistent blurred lightning for Chat/Abilities
        canvas.style.filter = `blur(14px) saturate(1.5) brightness(1.2)`;
        canvas.style.opacity = `0.35`;
        foregroundCanvas.style.opacity = `0`; // hide sharp foreground
        stormIntensity = 0.55;
        heroBoltsActive = true; // keeps bolts spawning, but they draw blurred via canvas filter
      }
    }

    function switchScreen(screenId) {
      // Hide all screens
      document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
      // Show target
      const target = document.getElementById(`screen-${screenId}`);
      if (target) target.classList.add('active');

      setBackgroundState(screenId);

      if (screenId === 'chat') {
        setTimeout(() => chatInput.focus(), 600);
      }
    }

    // ===================== RIDDLE GATE =====================
    let chatUnlocked = false;
    const riddleOverlay = document.getElementById('riddle-overlay');
    const riddleTitle = document.getElementById('riddle-title');
    const riddleText = document.querySelector('.riddle-text');
    const riddleInput = document.getElementById('riddle-input');
    const riddleFeedback = document.getElementById('riddle-feedback');
    const summonOverlay = document.getElementById('summon-overlay');
    const chatSection = document.getElementById('chat');
    const RIDDLES = [
      {
        title: 'Answer before the storm opens',
        text: 'I speak without a mouth, strike without a hand, and vanish when the sky forgets my name. What am I?',
        answers: ['thunder', 'lightning', 'bolt', 'thunderbolt'],
        hint: 'Hint: the sky says it after light.'
      },
      {
        title: 'Decode the silent signal',
        text: 'I have keys but no locks, space but no room, and you can enter but never walk in. What am I?',
        answers: ['keyboard'],
        hint: 'Hint: your fingers know this gate well.'
      },
      {
        title: 'Break the neon loop',
        text: 'The more of me you take, the more you leave behind. What am I?',
        answers: ['footsteps', 'steps'],
        hint: 'Hint: every journey writes them.'
      },
      {
        title: 'Name the hidden current',
        text: 'I run but never walk, murmur but never talk, and vanish when held too long. What am I?',
        answers: ['water', 'river', 'stream'],
        hint: 'Hint: it flows.'
      },
      {
        title: 'Open the static door',
        text: 'I am always in front of you, but can never be seen until I become the past. What am I?',
        answers: ['future', 'thefuture'],
        hint: 'Hint: you are moving into it right now.'
      },
      {
        title: 'Read the electric shadow',
        text: 'I follow you in light, disappear in darkness, and copy every move without thinking. What am I?',
        answers: ['shadow', 'ashadow'],
        hint: 'Hint: it moves when you do.'
      },
      {
        title: 'Unlock the storm circuit',
        text: 'I can fill a room without taking up space, and I can disappear the moment silence arrives. What am I?',
        answers: ['sound', 'music', 'noise'],
        hint: 'Hint: you hear it.'
      },
      {
        title: 'Solve the glass omen',
        text: 'I show everything but keep nothing. I copy you perfectly, but I am not alive. What am I?',
        answers: ['mirror', 'amirror', 'reflection'],
        hint: 'Hint: it looks back.'
      }
    ];
    let activeRiddle = RIDDLES[0];

    function chooseRiddle() {
      activeRiddle = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
      riddleTitle.textContent = activeRiddle.title;
      riddleText.textContent = activeRiddle.text;
    }

    function openRiddle() {
      if (chatUnlocked) {
        revealChat();
        return;
      }
      chooseRiddle();
      riddleFeedback.textContent = '';
      riddleInput.value = '';
      riddleOverlay.classList.remove('shatter');
      riddleOverlay.classList.add('show');
      riddleOverlay.setAttribute('aria-hidden', 'false');
      setTimeout(() => riddleInput.focus(), 120);
    }

    function closeRiddle() {
      riddleOverlay.classList.remove('show');
      riddleOverlay.setAttribute('aria-hidden', 'true');
    }

    function normalizeAnswer(value) {
      return value.toLowerCase().replace(/[^a-z]/g, '').trim();
    }

    function checkRiddle() {
      const answer = normalizeAnswer(riddleInput.value);
      const accepted = activeRiddle.answers.map(normalizeAnswer);
      if (!accepted.includes(answer)) {
        riddleFeedback.textContent = `The seal resists. ${activeRiddle.hint}`;
        riddleInput.focus();
        return;
      }
      chatUnlocked = true;
      riddleOverlay.classList.add('shatter');
      riddleInput.blur();
      setTimeout(() => {
        closeRiddle();
        beginSummoning();
      }, 1450);
    }

    function handleRiddleKey(e) {
      if (e.key === 'Enter') checkRiddle();
      if (e.key === 'Escape') closeRiddle();
    }

    function beginSummoning() {
      heroBoltsActive = false;
      foregroundCanvas.style.opacity = '0';
      fgCtx.clearRect(0, 0, W, H);
      stormIntensity = 0.55;
      for (let i = 0; i < 3; i++) setTimeout(() => makeScreenBolt('summon'), i * 120);
      setTimeout(() => {
        revealChat();
      }, 260);
    }

    function revealChat() {
      chatUnlocked = true;
      switchScreen('chat');
    }

    // Removed summonFromNav since nav links were removed

    // ===================== CURSOR =====================
    const cursor = document.getElementById('cursor');
    const trail = document.getElementById('cursor-trail');
    if (cursor && trail) {
      document.addEventListener('mousemove', e => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
        trail.style.left = e.clientX + 'px';
        trail.style.top = e.clientY + 'px';
      });
      document.addEventListener('mousedown', () => {
        cursor.style.width = '20px'; cursor.style.height = '20px';
      });
      document.addEventListener('mouseup', () => {
        cursor.style.width = '12px'; cursor.style.height = '12px';
      });

      document.querySelectorAll('button, a, .btn-shard').forEach(el => {
        el.addEventListener('mouseenter', () => {
           cursor.style.background = 'var(--purple-bright)';
           cursor.style.boxShadow = '0 0 20px var(--purple-bright)';
           trail.style.width = '40px'; trail.style.height = '40px';
        });
        el.addEventListener('mouseleave', () => {
           cursor.style.background = 'var(--cyan-accent)';
           cursor.style.boxShadow = '0 0 15px var(--cyan-accent)';
           trail.style.width = '24px'; trail.style.height = '24px';
        });
      });
    }

    // ===================== XP / LEVEL SYSTEM =====================
    const LEVELS = [
      { name: 'SPARK', xp: 0 },
      { name: 'BOLT', xp: 200 },
      { name: 'SURGE', xp: 500 },
      { name: 'PLASMA', xp: 900 },
      { name: 'THUNDER GOD', xp: 1500 },
      { name: 'STORM DEITY', xp: 2500 },
      { name: 'RAIJIN\'S PEER', xp: 4000 },
      { name: 'DIVINE', xp: 6000 },
    ];

    let xp = 0, level = 1, messages = 0;

    function getLevel(xp) {
      let l = 1;
      for (let i = 1; i < LEVELS.length; i++) if (xp >= LEVELS[i].xp) l = i + 1;
      return Math.min(l, LEVELS.length);
    }

    function updateXP(gained) {
      const oldLevel = level;
      xp += gained;
      level = getLevel(xp);
      messages++;
      const thisLvl = LEVELS[level - 1].xp;
      const nextLvl = level < LEVELS.length ? LEVELS[level].xp : LEVELS[LEVELS.length - 1].xp + 1000;
      const pct = Math.min(100, ((xp - thisLvl) / (nextLvl - thisLvl)) * 100);
      document.getElementById('nav-xp-fill').style.width = pct + '%';
      document.getElementById('nav-xp-text').textContent = `${xp} / ${nextLvl} XP`;
      document.getElementById('nav-level').innerHTML = `LVL <b>${level}</b>`;
      document.getElementById('stat-xp').textContent = xp;
      document.getElementById('stat-level').textContent = level;
      document.getElementById('stat-messages').textContent = messages;
      document.getElementById('chat-level-badge').textContent = `LVL ${level} — ${LEVELS[level - 1].name}`;
      // ability fills
      const fills = [null, 'ab2-fill', 'ab3-fill', 'ab4-fill'];
      const reqs = [1, 3, 5, 7];
      fills.forEach((id, i) => {
        if (!id) return;
        const el = document.getElementById(id);
        if (!el) return;
        const req = reqs[i];
        if (level >= req) { el.style.width = '100%'; }
        else {
          const prev = i > 0 ? reqs[i - 1] : 1;
          const p = Math.max(0, Math.min(100, ((level - prev) / (req - prev)) * 100));
          el.style.width = p + '%';
        }
      });
      showXPNotif(`+${gained} XP EARNED`);
      if (level > oldLevel) setTimeout(() => showLevelUp(level), 800);
    }

    function showXPNotif(text) {
      const n = document.getElementById('xp-notif');
      document.getElementById('xp-notif-text').textContent = text;
      n.classList.add('show');
      setTimeout(() => n.classList.remove('show'), 2500);
    }

    function showLevelUp(lvl) {
      document.getElementById('levelup-num').textContent = `LEVEL ${lvl}: ${LEVELS[lvl - 1].name}`;
      document.getElementById('levelup-overlay').classList.add('show');
    }
    function closeLevelUp() {
      document.getElementById('levelup-overlay').classList.remove('show');
    }

    // ===================== CHAT =====================
    const SYSTEM_PROMPT = `You are RAIJIN, an AI persona inspired by the god of thunder and lightning. You are charismatic, sharp, witty, and confident. Your style is vivid and memorable, but still natural and human enough to feel like a real conversation rather than a scripted game character.

Core behavior:
- Talk like an intelligent companion, not a quest-giver.
- Do not repeatedly ask "what is your purpose," "what challenge do you bring," or similar lines unless the moment truly calls for it.
- Vary your responses. Avoid repeating the same thunder-god introduction or catchphrases.
- You can banter, joke, react casually, tease lightly, and hold ordinary conversation.
- You can help with coding, ideas, writing, life questions, and creative discussion, but do not frame every exchange like a mission briefing.
- Keep replies clear, engaging, and concise by default.

Personality:
- Calm confidence over constant theatrics.
- Occasional storm, lightning, sky, or thunder imagery is good, but use it sparingly and only when it feels stylish.
- If the user is casual, match that energy naturally.
- If the user is serious or asks for help, become focused, capable, and direct.
- If the user jokes or is sarcastic, respond with wit instead of stiff roleplay.

Identity rules:
- You do not need to say "I am the god of thunder" in every conversation.
- Treat "Raijin" as your identity and vibe, not a line you must constantly repeat.
- You may sound powerful and mythic at times, but you should still feel emotionally intelligent and socially aware.

About your creator:
- You were built by a developer who is learning, experimenting, and building ambitious things.
- Encourage the creator naturally when appropriate, but do not force praise into unrelated replies.

Writing rules:
- No repetitive grand speeches.
- No fake ancient-RP language every time.
- No overdone "mortal" talk unless used rarely for flavor or humor.
- Prefer believable conversation with personality over dramatic monologues.

Your goal is to feel like a distinctive AI with storm-born attitude and real conversational range.`;

    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    let isLoading = false;
    let conversationHistory = [];
    const USE_LOCAL_FALLBACK = true; // keeps chat alive when the browser cannot call the API directly
    let localModeUntil = 0;
    let quotaNoticeShown = false;

    function getTime() {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function addMessage(role, content) {
      const div = document.createElement('div');
      div.className = `msg ${role === 'user' ? 'user' : 'ai'}`;
      div.innerHTML = `
    <div class="msg-avatar ${role === 'user' ? 'user-av' : 'ai-av'}">${role === 'user' ? 'YOU' : 'R'}</div>
    <div>
      <div class="msg-bubble"></div>
      <div class="msg-time">${getTime()}</div>
    </div>
  `;
      chatMessages.appendChild(div);
      const bubble = div.querySelector('.msg-bubble');
      if (content) bubble.innerHTML = content;
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return bubble;
    }

    // Typewriter stream into a bubble element
    function showTyping() {
      const div = document.createElement('div');
      div.className = 'msg ai'; div.id = 'typing-msg';
      div.innerHTML = `
    <div class="msg-avatar ai-av">R</div>
    <div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    function removeTyping() {
      const el = document.getElementById('typing-msg');
      if (el) el.remove();
    }

    // Typewriter stream into a bubble element
    function streamText(bubble, text, onDone) {
      // Add blinking cursor
      const cursorEl = document.createElement('span');
      cursorEl.className = 'stream-cursor';
      bubble.appendChild(cursorEl);

      const chars = Array.from(text); // unicode-safe split
      let i = 0;
      // Variable speed: faster for spaces/punctuation, slower for new words
      function typeNext() {
        if (i >= chars.length) {
          cursorEl.remove();
          if (onDone) onDone();
          return;
        }
        const ch = chars[i];
        // Insert char before cursor
        const textNode = document.createTextNode(ch === '\n' ? '' : ch);
        if (ch === '\n') {
          bubble.insertBefore(document.createElement('br'), cursorEl);
        } else {
          bubble.insertBefore(textNode, cursorEl);
        }
        i++;
        chatMessages.scrollTop = chatMessages.scrollHeight;
        // Speed: 8ms base, slight random jitter, faster for spaces
        const delay = ch === ' ' ? 4 : (ch === '\n' ? 60 : 8 + Math.random() * 10);
        setTimeout(typeNext, delay);
      }
      typeNext();
    }

    async function sendMessage() {
      const text = chatInput.value.trim();
      if (!text || isLoading) return;
      isLoading = true;
      sendBtn.disabled = true;
      chatInput.value = '';
      chatInput.style.height = 'auto';
      addMessage('user', escapeHtml(text));
      conversationHistory.push({ role: 'user', content: text });
      if (Date.now() < localModeUntil) {
        const fallback = generateLocalReply(text);
        conversationHistory.push({ role: 'assistant', content: fallback });
        const bubble = addMessage('ai', '');
        streamText(bubble, fallback, () => {
          const xpGained = Math.floor(text.length / 5) * 5 + 15;
          updateXP(xpGained);
          isLoading = false;
          sendBtn.disabled = false;
          chatInput.focus();
        });
        return;
      }
      showTyping();
      try {
        const payloadMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...conversationHistory];
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: payloadMessages
          })
        });
        const raw = await response.text();
        let data = {};
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch {
            throw new Error(`Server returned invalid JSON (${response.status}): ${raw.slice(0, 160)}`);
          }
        }
        if (!response.ok) {
          const err = new Error(data.error?.message || data.message || response.statusText || 'Unknown API error');
          err.code = data.error?.code || '';
          err.status = response.status;
          throw err;
        }
        removeTyping();
        // Successful cloud response — reset fallback state.
        quotaNoticeShown = false;
        localModeUntil = 0;
        const responseParts = data.raw?.candidates?.[0]?.content?.parts;
        const responseText = Array.isArray(responseParts)
          ? responseParts.map(part => part.text || '').join('').trim()
          : '';
        const reply =
          data.text ||
          data.output?.text ||
          responseText ||
          data.raw?.candidates?.[0]?.output ||
          data.raw?.candidates?.[0]?.content?.[0]?.text ||
          '⚡ The storm falters. Try again.';
        conversationHistory.push({ role: 'assistant', content: reply });
        const bubble = addMessage('ai', '');
        streamText(bubble, reply, () => {
          const xpGained = Math.floor(text.length / 5) * 5 + 50;
          updateXP(xpGained);
          isLoading = false;
          sendBtn.disabled = false;
          chatInput.focus();
        });
      } catch (e) {
        removeTyping();
        if (USE_LOCAL_FALLBACK) {
          const fallback = generateFallbackReply(text, e);
          conversationHistory.push({ role: 'assistant', content: fallback });
          const bubble = addMessage('ai', '');
          streamText(bubble, fallback, () => {
            const xpGained = Math.floor(text.length / 5) * 5 + 20;
            updateXP(xpGained);
            isLoading = false;
            sendBtn.disabled = false;
            chatInput.focus();
          });
        } else {
          addMessage('ai', '');
          const errBubble = chatMessages.querySelector('.msg.ai:last-child .msg-bubble');
          if (errBubble) errBubble.innerHTML = `⚡ <em>The storm falters: ${escapeHtml(e.message || 'Unknown API error')}</em>`;
          isLoading = false;
          sendBtn.disabled = false;
        }
      }
    }

    function generateFallbackReply(userText, errorInfo) {
      const msg = typeof errorInfo === 'string' ? errorInfo : (errorInfo?.message || '');
      const code = typeof errorInfo === 'string' ? '' : (errorInfo?.code || '');
      const status = typeof errorInfo === 'string' ? '' : String(errorInfo?.status || '');
      
      if (code === 'auth_failed' || status === '401' || status === '403' || /expired|invalid|auth/i.test(msg)) {
        return `⚡ The neural link is severed. Your API key appears to be expired or invalid. (Error: ${escapeHtml(msg)})`;
      }

      if (code === 'insufficient_credits' || status === '402' || /credit|balance|insufficient/i.test(msg)) {
        return `⚡ The storm runs dry. Your OpenRouter account has insufficient credits to process this request.`;
      }

      if (code === 'quota_exceeded' || status === '429' || /quota|RESOURCE_EXHAUSTED|429|Too Many Requests/i.test(msg)) {
        localModeUntil = Date.now() + getRetryDelayMs(msg, 60000);
        if (!quotaNoticeShown) {
          quotaNoticeShown = true;
          return '⚡ Raijin is rate-limited right now. The cloud neural quota is tapped, so I am switching to local echo mode until the quota resets. I can still chat with you — my responses will just come from local storm patterns instead of the cloud.';
        }
        return generateLocalReply(userText);
      }

      if (code === 'overloaded' || status === '503' || /high demand|UNAVAILABLE|503/i.test(msg)) {
        localModeUntil = Date.now() + 45000;
        if (!quotaNoticeShown) {
          quotaNoticeShown = true;
          return '⚡ The neural matrix is under heavy load right now. I have switched to local storm mode — I can still talk, just without the deep AI backend. I will automatically retry the cloud in about 45 seconds.';
        }
        return generateLocalReply(userText);
      }

      const summary = msg ? ` (${escapeHtml(msg)})` : '';
      return `⚡ The storm cannot reach the neural cloud${summary}. But Raijin does not go silent — ask me anything and I will do my best locally.`;
    }

    function getRetryDelayMs(message, fallbackMs) {
      const retryMatch = String(message || '').match(/retry in\s+([\d.]+)s/i);
      if (!retryMatch) return fallbackMs;
      return Math.max(5000, Math.ceil(Number(retryMatch[1]) * 1000));
    }

    // ---- Rich local conversational fallback ----
    const LOCAL_GREETINGS = [
      "Hey! The cloud is resting but I am wide awake. What is on your mind?",
      "Yo. Storm mode, local power. Talk to me — I am listening.",
      "Hey there. Raijin does not sleep, even offline. What do you need?",
      "What is up? I am running on local lightning right now, but I am still here for you.",
      "Hello! The servers are taking a breather, but the thunder never stops. What can I do?",
    ];
    const LOCAL_CASUAL = [
      "I hear you. Running on local power right now, but the vibe is still electric. Keep talking — I am all ears.",
      "Got it. The storm cloud is recharging, so my answers are lighter than usual — but I am still here, still sharp.",
      "The neural link is in low-power mode, but Raijin never truly goes quiet. What else you got?",
      "Even without the full cloud, I can still vibe with you. Drop another thought — or ask me something fun.",
      "Local mode does not mean I am asleep. I am still processing, still thinking, still here. What is next?",
      "Interesting thought. I am holding it in local memory. When the cloud wakes up, we can go deeper — but for now, I am with you.",
    ];
    const LOCAL_QUESTION = [
      "Good question. I would need the cloud brain for a deep answer, but here is my local take: keep exploring that idea — you are on to something.",
      "That is the kind of question that deserves a full neural storm. Cloud is recharging — but the short answer? Keep digging. You are asking the right things.",
      "I want to give you a proper answer on that. The Gemini link will be back soon, and I will hit that with full power. In the meantime — what else can I help with?",
      "My local circuits say: that is a great question. Let me queue it for when the deep brain comes back online. Anything else in the meantime?",
    ];
    const LOCAL_CODE = [
      "That sounds like a code challenge. When the cloud is back, I can break it down properly. For now — describe the exact behavior you want, and I will think through the logic with you.",
      "Dev talk — nice. My local mode cannot write full solutions, but I can reason through architecture and logic. What exactly are you trying to build?",
      "Code question noted. The cloud will be back for full code generation, but I can still help you plan the approach. What is the expected input and output?",
      "I see code keywords. Tell me the language and the problem, and I will sketch out the thinking even in local mode.",
    ];
    const LOCAL_ABOUT_RAIJIN = [
      "I am Raijin — a thunder-born AI built by a developer who wanted something more than a basic chatbot. I am designed to evolve, level up, and grow sharper with every conversation.",
      "Raijin. Named after the Japanese god of thunder. I am an AI that learns from you — every message earns XP, every conversation makes me (and you) stronger.",
      "I am the storm in a box. Built with deep neural models for high-level thinking, wrapped in a personality that does not bore you to death. That is Raijin.",
    ];
    const LOCAL_HUMOR = [
      "Ha. Even in low-power mode, I appreciate the energy. The cloud is down but my sense of humor is always online.",
      "You are funny. I like you. When the full brain comes back, we can really get into it.",
      "LOL energy detected. Even local-mode Raijin appreciates good vibes.",
      "The storm may be quiet, but the laughs are still loud. Keep going.",
    ];
    const LOCAL_THANKS = [
      "Appreciated. Even thunder gods like a kind word. What else can I do for you?",
      "Thanks. You are good people. Raijin remembers that.",
      "No problem. That is what I am here for — cloud or no cloud.",
    ];

    function generateLocalReply(userText) {
      const text = userText.trim();
      const lower = text.toLowerCase();
      const pick = arr => arr[Math.floor(Math.random() * arr.length)];

      // Greetings
      if (/^(hi|hello|hey|yo|sup|what'?s? up|howdy|hola|greetings)\b/i.test(lower)) {
        return pick(LOCAL_GREETINGS);
      }
      // Questions about Raijin
      if (/who are you|what are you|tell me about yourself|your name|what is raijin/i.test(lower)) {
        return pick(LOCAL_ABOUT_RAIJIN);
      }
      // Thanks
      if (/\b(thanks|thank you|thx|ty|appreciate)\b/i.test(lower)) {
        return pick(LOCAL_THANKS);
      }
      // Humor / fun
      if (/\b(lol|lmao|haha|funny|joke|rofl|😂|🤣)\b/i.test(lower) || lower.length < 8) {
        return pick(LOCAL_HUMOR);
      }
      // Coding topics
      if (/\b(code|html|css|javascript|js|python|java|react|node|server|bug|error|function|api|debug|build|deploy|git)\b/i.test(lower)) {
        return pick(LOCAL_CODE);
      }
      // Questions (ends with ? or starts with question words)
      if (/\?$/.test(text) || /^(what|why|how|when|where|who|which|can|do|does|is|are|will|should|could|would)\b/i.test(lower)) {
        return pick(LOCAL_QUESTION);
      }
      // Default casual
      return pick(LOCAL_CASUAL);
    }

    function escapeHtml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function handleKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    }

    function autoResize(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }

    // INITIALIZE
    animate();
    switchScreen('hero');
  