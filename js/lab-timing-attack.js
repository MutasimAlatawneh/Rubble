/* ==========================================================================
   Lab 2 — Client-Side Timing Attack (OWASP Top 10:2021 A02, CWE-208)
   --------------------------------------------------------------------------
   The checkers and the attacker's script below are the REAL code this page
   runs; the code blocks on the page are generated from them.
   ========================================================================== */
'use strict';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const SECRET_LENGTH = 5;
const TICK_MS = 2;          // AMPLIFIED cost of comparing ONE character
const REAL_COMPARE_MS = 1e-6; // what it really costs on a modern CPU: ~1 ns
const SAMPLES = 3;          // the attacker times each guess 3 times and keeps the median

/* The amplification factor printed on the page is COMPUTED from the two
   constants above (TICK_MS ÷ REAL_COMPARE_MS), so the label always matches. */
const AMPLIFICATION = Math.round(TICK_MS / REAL_COMPARE_MS);

/* Simulated work: a busy-wait. Comparing one character really takes about a
   nanosecond, far too fast for a browser clock to see, so each comparison
   costs TICK_MS instead. This is the ONLY exaggeration in the lab. */
function tick() {
  const end = performance.now() + TICK_MS;
  while (performance.now() < end) { /* busy-wait = simulated work */ }
}

/* VULNERABLE: stops at the first wrong character. */
function checkSecret(guess, secret) {
  if (guess.length !== secret.length) return false;
  for (let i = 0; i < secret.length; i++) {
    tick(); // simulated cost of comparing one character
    if (guess[i] !== secret[i]) return false; // BUG: exits early
  }
  return true;
}

/* FIXED: always compares every character (constant time). */
function safeCheckSecret(guess, secret) {
  if (guess.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) {
    tick(); // simulated cost of comparing one character
    diff |= guess.charCodeAt(i) ^ secret.charCodeAt(i); // FIX: never exits
  }
  return diff === 0;
}

/* THE ATTACKER'S SCRIPT. It never sees the secret: it can only call
   login(guess), which answers true/false, and time how long that takes. */
async function timingAttack(login, positions, onUpdate) {
  let known = '';
  for (let pos = 0; pos < positions; pos++) {
    const results = [];
    for (const char of ALPHABET) {
      const guess = (known + char).padEnd(SECRET_LENGTH, '_'); // '_' never matches
      const times = [];
      let accepted = false;
      for (let s = 0; s < SAMPLES; s++) {
        const start = performance.now();
        accepted = login(guess);
        times.push(performance.now() - start);
      }
      results.push({ char, ms: median(times), accepted });
      onUpdate({ pos, known, results, done: false });
      await yieldToBrowser(); // let the page repaint the bars
    }
    // A "true" answer wins outright; otherwise trust the SLOWEST guess.
    const best = results.find(r => r.accepted) ||
                 results.reduce((a, b) => (b.ms > a.ms ? b : a));
    known += best.char;
    onUpdate({ pos, known, results, best, done: true });
  }
  return known;
}

/* ---------- small helpers ---------- */
function median(list) {
  const s = [...list].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
function yieldToBrowser() {
  return new Promise(resolve => setTimeout(resolve, 0));
}
function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(SECRET_LENGTH));
  return [...bytes].map(b => ALPHABET[b % ALPHABET.length]).join('');
}

/* Payloads — shared by "Try it" and "The fix", so both modes run the same attack. */
const PAYLOADS = [
  { id: 'scan', label: 'Scan first letter',    positions: 1 },
  { id: 'full', label: 'Recover whole secret', positions: SECRET_LENGTH },
];

/* The "server". A fresh random secret lives here; only login() is handed out. */
let secret = randomSecret();
function makeLogin(mode) {
  const check = mode === 'fixed' ? safeCheckSecret : checkSecret;
  return guess => check(guess, secret);
}

/* --------------------------------------------------------------------------
   Page wiring
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  Rubble.renderAll({ tick, checkSecret, safeCheckSecret, timingAttack });

  // Print the real numbers from the constants, so the label can't drift from the code.
  document.querySelectorAll('.js-tick-ms').forEach(el => (el.textContent = String(TICK_MS)));
  document.querySelectorAll('.js-amp-factor').forEach(el => (el.textContent = AMPLIFICATION.toLocaleString('en-US')));

  const $ = id => document.getElementById(id);
  let revealed = false;

  /* ---- shared secret display ---- */
  function showSecret() {
    document.querySelectorAll('.secret-value').forEach(el => {
      el.textContent = revealed ? secret : '•'.repeat(SECRET_LENGTH);
    });
    document.querySelectorAll('.js-reveal').forEach(b => {
      b.textContent = revealed ? 'Hide' : 'Reveal';
      b.setAttribute('aria-pressed', String(revealed));
    });
  }
  document.querySelectorAll('.js-reveal').forEach(b =>
    b.addEventListener('click', () => { revealed = !revealed; showSecret(); }));
  document.querySelectorAll('.js-new-secret').forEach(b =>
    b.addEventListener('click', () => {
      secret = randomSecret();
      showSecret();
      ['try', 'fix'].forEach(p => resetPanel(p));
    }));

  /* ---- one "attack panel" = slots + bar chart + status + log ---- */
  function resetPanel(prefix) {
    const slots = $(`ta-${prefix}-slots`);
    slots.innerHTML = '';
    for (let i = 0; i < SECRET_LENGTH; i++) {
      const s = document.createElement('span');
      s.className = 'slot';
      s.textContent = '?';
      slots.append(s);
    }
    const bars = $(`ta-${prefix}-bars`);
    bars.innerHTML = '';
    for (const c of ALPHABET) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.innerHTML = `<span class="bar-fill"></span><span class="bar-label">${c}</span>`;
      bars.append(bar);
    }
    $(`ta-${prefix}-caption`).textContent = 'Time per guess will appear here.';
  }

  function drawProgress(prefix, { pos, known, results, best, done }) {
    const slots = $(`ta-${prefix}-slots`).children;
    for (let i = 0; i < SECRET_LENGTH; i++) {
      slots[i].textContent = known[i] || (i === pos && !done ? '…' : '?');
      slots[i].classList.toggle('is-active', i === pos && !done);
    }
    const max = Math.max(...results.map(r => r.ms), 0.001);
    const bars = $(`ta-${prefix}-bars`).children;
    results.forEach((r, i) => {
      bars[i].querySelector('.bar-fill').style.height = `${Math.max(4, (r.ms / max) * 100)}%`;
      bars[i].classList.toggle('is-best', !!best && r.char === best.char);
      bars[i].title = `${r.char}: ${r.ms.toFixed(1)} ms`;
    });
    $(`ta-${prefix}-caption`).textContent =
      `Letter #${pos + 1}: median time per guess (taller = slower). ` +
      (best ? `Slowest: “${best.char}” at ${best.ms.toFixed(1)} ms.` : 'Measuring…');
  }

  /* Grade the attacker's result against the real secret (the attacker can't do this). */
  function grade(prefix, known) {
    const slots = $(`ta-${prefix}-slots`).children;
    for (let i = 0; i < known.length; i++) {
      slots[i].classList.toggle('is-right', known[i] === secret[i]);
      slots[i].classList.toggle('is-wrong', known[i] !== secret[i]);
    }
  }

  /* Run one payload in one mode, drawing into one panel. Returns a summary. */
  async function runAttack(prefix, payload, mode) {
    const logEl = $(`ta-${prefix}-log`);
    resetPanel(prefix);
    Rubble.log(logEl, `▶ [${mode.toUpperCase()}] ${payload.label}`, 'muted');

    const known = await timingAttack(makeLogin(mode), payload.positions, step => {
      drawProgress(prefix, step);
      if (step.done) {
        const others = step.results.filter(r => r !== step.best);
        const avg = others.reduce((sum, r) => sum + r.ms, 0) / others.length;
        Rubble.log(logEl, `  letter #${step.pos + 1}: slowest “${step.best.char}” ` +
          `${step.best.ms.toFixed(1)} ms vs ~${avg.toFixed(1)} ms for the rest` +
          (step.best.accepted ? '  (login returned true)' : ''));
      }
    });
    grade(prefix, known);

    const correct = [...known].filter((c, i) => c === secret[i]).length;
    const success = correct === known.length;
    const status = $(`ta-${prefix}-status`);
    status.className = 'status ' + (success ? 'status--danger' : 'status--safe');
    if (payload.positions === SECRET_LENGTH) {
      const loggedIn = makeLogin(mode)(known);
      Rubble.log(logEl, `  login("${known}") → ${loggedIn}   ` +
        (loggedIn ? '⚠ SECRET RECOVERED' : '✓ attack failed'), loggedIn ? 'danger' : 'safe');
      status.innerHTML = loggedIn
        ? `<span aria-hidden="true">🔓</span><span><strong>Secret recovered:</strong> <code>${known}</code>. The attacker can log in.</span>`
        : `<span aria-hidden="true">🔒</span><span><strong>Attack failed.</strong> Best guess <code>${known}</code> is wrong (${correct}/${SECRET_LENGTH} letters right${correct ? ', by luck' : ''}). Every guess took the same time.</span>`;
    } else {
      Rubble.log(logEl, `  first letter guessed: “${known}” → ` +
        (success ? '⚠ correct' : '✓ wrong'), success ? 'danger' : 'safe');
      status.innerHTML = success
        ? `<span aria-hidden="true">🔓</span><span><strong>First letter leaked:</strong> <code>${known}</code>. One tall bar gave it away.</span>`
        : `<span aria-hidden="true">🔒</span><span><strong>No leak.</strong> All bars are about equal; the guess “${known}” is wrong.</span>`;
    }
    return { known, success };
  }

  /* Lock every control while an attack runs, so runs never overlap. */
  // Lock the buttons while a run is in progress (shared helper in common.js).
  const exclusive = task => Rubble.exclusive(task);

  function makePayloadButtons(container, onPick) {
    PAYLOADS.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--payload';
      btn.textContent = p.label;
      btn.addEventListener('click', () => onPick(p));
      container.append(btn);
    });
  }

  /* ---- Section 3: Try it (always VULNERABLE) ---- */
  makePayloadButtons($('ta-try-payloads'), p => exclusive(() => runAttack('try', p, 'vulnerable')));

  /* ---- Section 5: The fix ---- */
  let lastPayload = PAYLOADS[1];
  const toggle = Rubble.initToggle($('ta-toggle'), () =>
    exclusive(() => runAttack('fix', lastPayload, toggle.mode)));   // same payload, new mode
  makePayloadButtons($('ta-fix-payloads'), p => {
    lastPayload = p;
    $('ta-fix-current').textContent = p.label;
    exclusive(() => runAttack('fix', p, toggle.mode));
  });
  $('ta-fix-current').textContent = lastPayload.label;

  $('ta-both').addEventListener('click', () => exclusive(async () => {
    $('ta-both-payload').textContent = lastPayload.label;
    for (const [mode, id] of [['vulnerable', 'ta-both-vuln'], ['fixed', 'ta-both-fixed']]) {
      $(id).textContent = 'running…';
      delete $(id).dataset.result;
      const { known, success } = await runAttack('fix', lastPayload, mode);
      $(id).textContent = `attacker's guess: ${known}\n` + (success ? '⚠ matches the secret' : '✗ wrong, attack failed');
      $(id).dataset.result = success ? 'danger' : 'safe';
    }
  }));

  ['try', 'fix'].forEach(p => {
    resetPanel(p);
    $(`ta-${p}-clear`).addEventListener('click', () => Rubble.clear($(`ta-${p}-log`)));
  });
  showSecret();
});
