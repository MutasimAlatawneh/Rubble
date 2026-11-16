/* ==========================================================================
   Lab 3 — ReDoS: Regular Expression Denial of Service
           (OWASP Top 10:2021 A04, CWE-1333)
   --------------------------------------------------------------------------
   The two validators below are the REAL code this page runs; the code blocks
   on the page are generated from them.

   SAFETY: the vulnerable regex really does freeze this tab. To keep that
   freeze short, the page first measures how fast YOUR machine is and then
   sizes the attack strings so the worst one stalls for at most ~1.5 s.
   ========================================================================== */
'use strict';

/* VULNERABLE signup validator. */
function validateSignup(form) {
  const errors = [];
  // Usernames: lowercase letters and digits only.
  const USERNAME = /^([a-z0-9]+)+$/; // BUG: nested + backtracks
  if (!USERNAME.test(form.username)) {
    errors.push('Username may only use a-z and 0-9');
  }
  if (form.username.length < 3) {
    errors.push('Username is too short');
  }
  return errors;
}

/* FIXED: identical, except the regex has no nested quantifier. */
function safeValidateSignup(form) {
  const errors = [];
  // Usernames: lowercase letters and digits only.
  const USERNAME = /^[a-z0-9]+$/; // FIX: single +, linear time
  if (!USERNAME.test(form.username)) {
    errors.push('Username may only use a-z and 0-9');
  }
  if (form.username.length < 3) {
    errors.push('Username is too short');
  }
  return errors;
}

/* --------------------------------------------------------------------------
   Calibration — the safety cap.
   Each extra "a" roughly DOUBLES the work for the vulnerable regex. We time
   short strings, then pick lengths that should take ~0.15 s and ≤ 1.5 s here.
   -------------------------------------------------------------------------- */
const MAX_FREEZE_MS = 1500;

function evilString(n) {
  return 'a'.repeat(n) + '!';   // the "!" forces the regex to fail at the very end
}

function timeVulnerable(n) {
  const form = { username: evilString(n) };
  const start = performance.now();
  validateSignup(form);
  return performance.now() - start;
}

function calibrate() {
  timeVulnerable(14); timeVulnerable(14);           // warm-up: let the engine compile the regex
  let n = 14;
  let t = timeVulnerable(n);
  while (t < 8 && n < 40) t = timeVulnerable(++n);  // grow until one run takes ≥ 8 ms
  // Assume AT LEAST doubling per character. Assuming faster growth than
  // reality only makes the strings shorter, so this is the safe direction.
  const growth = Math.max(2, timeVulnerable(n + 1) / t);
  const lengthFor = targetMs => n + Math.floor(Math.log(targetMs / t) / Math.log(growth));
  return { medium: lengthFor(150), large: lengthFor(MAX_FREEZE_MS) };
}

/* Payloads — shared by "Try it" and "The fix". Lengths are filled in by calibrate(). */
const PAYLOADS = [
  { id: 'normal', label: 'Normal: rubble42', value: 'rubble42' },
  { id: 'medium', label: 'Evil (short stall)', value: null },
  { id: 'large',  label: 'Evil (≤1.5 s freeze)', value: null },
];

/* Run one payload against one validator and measure it. */
function runPayload(value, mode) {
  const validate = mode === 'fixed' ? safeValidateSignup : validateSignup;
  const start = performance.now();
  const errors = validate({ username: value });
  const ms = performance.now() - start;
  return { ms, errors };
}

/* Anything under 1 ms is shown as "< 1 ms": Firefox's clock only ticks in
   1 ms steps, so claiming more precision than that would not be honest. */
function formatMs(ms) {
  return ms < 1 ? '< 1 ms' : ms < 10 ? `${ms.toFixed(1)} ms` : `${Math.round(ms).toLocaleString('en-US')} ms`;
}

function describe(value) {
  const m = /^(a+)!$/.exec(value);
  return m ? `"a"×${m[1].length} + "!" (${value.length} chars)` : `"${value}"`;
}

/* --------------------------------------------------------------------------
   Page wiring
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  Rubble.renderAll({ validateSignup, safeValidateSignup });

  const $ = id => document.getElementById(id);

  /* ---- Heartbeat: a clock driven by JavaScript on every frame.
          While the regex runs, JavaScript is blocked, so it visibly STOPS. ---- */
  const pageStart = performance.now();
  function heartbeat() {
    const s = (performance.now() - pageStart) / 1000;
    document.querySelectorAll('.heartbeat-clock').forEach(el => (el.textContent = s.toFixed(2) + ' s'));
    document.querySelectorAll('.heartbeat-dot').forEach(el => {
      el.style.left = `${((s % 2) / 2) * 100}%`;   // sweeps across the track every 2 s
    });
    requestAnimationFrame(heartbeat);
  }
  requestAnimationFrame(heartbeat);

  /* ---- Show a run's result in one panel ---- */
  function report(prefix, value, mode, out) {
    const ok = out.errors.length === 0;
    const slow = out.ms >= 50;
    const status = $(`rd-${prefix}-status`);
    status.className = 'status ' + (slow ? 'status--danger' : 'status--safe');
    status.innerHTML = slow
      ? `<span aria-hidden="true">🥶</span><span><strong>Tab frozen for ${formatMs(out.ms)}.</strong> The clock above stopped while the regex backtracked.</span>`
      : `<span aria-hidden="true">⚡</span><span><strong>Answered in ${formatMs(out.ms)}.</strong> The page never froze.</span>`;
    $(`rd-${prefix}-timer`).textContent = formatMs(out.ms);

    Rubble.log($(`rd-${prefix}-log`),
      `[${mode.toUpperCase()}] ${describe(value)} → ${ok ? 'valid' : 'rejected'} in ${formatMs(out.ms)}` +
      (slow ? '   ⚠ FROZE THE TAB' : ''), slow ? 'danger' : 'safe');
  }

  /* Paint "running…" first, then do the (possibly freezing) work. */
  async function run(prefix, payload, mode) {
    $(`rd-${prefix}-timer`).textContent = 'running…';
    const status = $(`rd-${prefix}-status`);
    status.className = 'status status--warn';
    status.innerHTML = `<span aria-hidden="true">⏳</span><span>Testing ${describe(payload.value)} with the <strong>${mode}</strong> regex… watch the clock.</span>`;
    await Rubble.nextPaint();
    const out = runPayload(payload.value, mode);
    report(prefix, payload.value, mode, out);
    await Rubble.nextPaint();
    return out;
  }

  // Lock the buttons while a run is in progress (shared helper in common.js).
  const exclusive = task => Rubble.exclusive(task);

  function makePayloadButtons(container, onPick) {
    PAYLOADS.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--payload';
      btn.dataset.payload = p.id;
      btn.textContent = p.label;
      btn.addEventListener('click', () => onPick(p));
      container.append(btn);
    });
  }

  /* ---- Section 3: Try it (always VULNERABLE) ---- */
  makePayloadButtons($('rd-try-payloads'), p => exclusive(() => run('try', p, 'vulnerable')));

  /* ---- Section 5: The fix ---- */
  let lastPayload = PAYLOADS[1];
  const toggle = Rubble.initToggle($('rd-toggle'), () =>
    exclusive(() => run('fix', lastPayload, toggle.mode)));      // same payload, new mode
  makePayloadButtons($('rd-fix-payloads'), p => {
    lastPayload = p;
    $('rd-fix-current').textContent = describe(p.value);
    exclusive(() => run('fix', p, toggle.mode));
  });

  $('rd-both').addEventListener('click', () => exclusive(async () => {
    $('rd-both-payload').textContent = describe(lastPayload.value);
    for (const [mode, id] of [['vulnerable', 'rd-both-vuln'], ['fixed', 'rd-both-fixed']]) {
      const out = await run('fix', lastPayload, mode);
      $(id).textContent = `${formatMs(out.ms)}\n${out.ms >= 50 ? '⚠ froze the tab' : '✓ instant'}`;
      $(id).dataset.result = out.ms >= 50 ? 'danger' : 'safe';
    }
  }));

  ['try', 'fix'].forEach(p =>
    $(`rd-${p}-clear`).addEventListener('click', () => Rubble.clear($(`rd-${p}-log`))));

  /* ---- Calibrate once the page has painted, then label the buttons ---- */
  document.querySelectorAll('#try button, #fix button').forEach(b => (b.disabled = true));
  Rubble.nextPaint().then(() => {
    const sizes = calibrate();
    PAYLOADS[1].value = evilString(sizes.medium);
    PAYLOADS[2].value = evilString(sizes.large);
    document.querySelectorAll('button[data-payload]').forEach(btn => {
      const p = PAYLOADS.find(x => x.id === btn.dataset.payload);
      if (p.id !== 'normal') btn.textContent = `${p.label}: "a"×${p.value.length - 1}+"!"`;
      btn.title = p.value;
    });
    $('rd-fix-current').textContent = describe(lastPayload.value);
    $('rd-calibration').textContent =
      `Calibrated for this device: the evil strings are ${sizes.medium + 1} and ${sizes.large + 1} characters long.`;
    document.querySelectorAll('#try button, #fix button').forEach(b => (b.disabled = false));
  });
});
