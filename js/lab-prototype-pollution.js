/* ==========================================================================
   Lab 1 — Prototype Pollution (OWASP Top 10:2021 A08, CWE-1321)
   --------------------------------------------------------------------------
   The two merge functions below are the REAL code this page runs. The code
   blocks on the page are generated from them (see Rubble.renderAll), so what
   you read is exactly what executes.
   ========================================================================== */
'use strict';

/* VULNERABLE: deep-copies every key of `source` into `target`. */
function merge(target, source) {
  for (const key in source) {
    const value = source[key];
    if (typeof value === 'object' && value !== null) {
      if (!target[key]) target[key] = {};
      merge(target[key], value); // BUG: "__proto__" → Object.prototype
    } else {
      target[key] = value;
    }
  }
  return target;
}

/* FIXED: identical, except for ONE added line. */
function safeMerge(target, source) {
  for (const key in source) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue; // FIX
    const value = source[key];
    if (typeof value === 'object' && value !== null) {
      if (!target[key]) target[key] = {};
      safeMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

/* --------------------------------------------------------------------------
   Payloads — defined ONCE and shared by "Try it" and "The fix", so both
   sections (and both modes) always send the exact same bytes.
   -------------------------------------------------------------------------- */
const PAYLOADS = [
  { label: 'Normal settings',     json: '{"theme":"dark","notifications":{"email":true}}' },
  { label: '__proto__ attack',    json: '{"__proto__":{"isAdmin":true}}' },
  { label: 'constructor attack',  json: '{"constructor":{"prototype":{"isAdmin":true}}}' },
];

/* --------------------------------------------------------------------------
   Safety net. Polluting Object.prototype affects EVERY object on the page,
   so we take a snapshot of the built-in prototypes before each run and put
   everything back afterwards. The attack is real, but it never outlives
   the single run that triggered it.
   -------------------------------------------------------------------------- */
const GUARDED = [Object.prototype, Function.prototype, Object, Function];

function withPrototypeGuard(run) {
  const snapshots = GUARDED.map(obj => Object.getOwnPropertyDescriptors(obj));
  const polluted = [];
  let result, error;

  try {
    result = run();
  } catch (e) {
    error = e;
  } finally {
    GUARDED.forEach((obj, i) => {
      const before = snapshots[i];
      for (const name of Object.getOwnPropertyNames(obj)) {
        // Object.hasOwn, NOT `name in before`: the snapshot itself inherits
        // from the (possibly polluted) Object.prototype, so `in` would lie.
        if (!Object.hasOwn(before, name)) {
          polluted.push(name);              // a brand-new key was injected
          delete obj[name];
        } else if ('value' in before[name] && obj[name] !== before[name].value) {
          polluted.push(name);              // an existing key was overwritten
          Object.defineProperty(obj, name, before[name]);
        }
      }
    });
  }
  return { result, error, polluted };
}

/* Run one payload against one version of merge(). */
function runPayload(json, mode) {
  const mergeFn = mode === 'fixed' ? safeMerge : merge;

  let input;
  try {
    input = JSON.parse(json);
  } catch (e) {
    return { error: new Error('Invalid JSON — ' + e.message), polluted: [] };
  }

  return withPrototypeGuard(() => {
    const settings = { theme: 'light' };   // the app's own settings object
    mergeFn(settings, input);              // merge the user's JSON into it

    const guest = {};                      // a brand-new, UNRELATED object
    return {
      settings: JSON.stringify(settings),
      guestIsAdmin: guest.isAdmin === true,
      guestValue: String(guest.isAdmin),
    };
  });
}

/* --------------------------------------------------------------------------
   Page wiring
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  Rubble.renderAll({ merge, safeMerge });

  const $ = id => document.getElementById(id);
  const tryInput = $('pp-input');
  const tryLog = $('pp-try-log');
  const fixLog = $('pp-fix-log');
  let lastPayload = PAYLOADS[1].json;     // default for the toggle / compare

  /* Show the "admin panel" status box. */
  function showStatus(el, out) {
    const hacked = out.result && out.result.guestIsAdmin;
    el.className = 'status ' + (out.error ? 'status--warn' : hacked ? 'status--danger' : 'status--safe');
    el.innerHTML = out.error
      ? '<span aria-hidden="true">⚠️</span> <span>Run failed — see output.</span>'
      : hacked
        ? '<span aria-hidden="true">🔓</span> <span><strong>Admin panel UNLOCKED.</strong> A fresh <code>{}</code> says <code>isAdmin = true</code>.</span>'
        : '<span aria-hidden="true">🔒</span> <span><strong>Admin panel locked.</strong> A fresh <code>{}</code> has no <code>isAdmin</code>.</span>';
  }

  /* Write a run's details to a console. */
  function report(logEl, json, mode, out) {
    Rubble.log(logEl, `▶ [${mode.toUpperCase()}] merge(settings, ${json})`, 'muted');
    if (out.error) {
      Rubble.log(logEl, '  ' + out.error.message, 'warn');
      return;
    }
    Rubble.log(logEl, `  settings now: ${out.result.settings}`);
    if (out.result.guestIsAdmin) {
      Rubble.log(logEl, `  const guest = {};  guest.isAdmin → ${out.result.guestValue}   ⚠ POLLUTED`, 'danger');
    } else {
      Rubble.log(logEl, `  const guest = {};  guest.isAdmin → ${out.result.guestValue}   ✓ clean`, 'safe');
    }
    if (out.polluted.length) {
      Rubble.log(logEl, `  Injected into a built-in prototype: ${out.polluted.join(', ')} (auto-cleaned after this run)`, 'warn');
    }
  }

  /* Build one button per payload inside a container. */
  function makePayloadButtons(container, onPick) {
    PAYLOADS.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--payload';
      btn.textContent = p.label;
      btn.title = p.json;
      btn.addEventListener('click', () => onPick(p.json));
      container.append(btn);
    });
  }

  /* ---- Section 3: Try it (always the VULNERABLE merge) ---- */
  function tryRun(json) {
    tryInput.value = json;
    const out = runPayload(json, 'vulnerable');
    report(tryLog, json, 'vulnerable', out);
    showStatus($('pp-try-status'), out);
  }
  makePayloadButtons($('pp-try-payloads'), tryRun);
  $('pp-run').addEventListener('click', () => tryRun(tryInput.value));
  $('pp-try-clear').addEventListener('click', () => Rubble.clear(tryLog));

  /* ---- Section 5: The fix (toggle between versions) ---- */
  function fixRun(json) {
    lastPayload = json;
    $('pp-fix-current').textContent = json;
    const out = runPayload(json, toggle.mode);
    report(fixLog, json, toggle.mode, out);
    showStatus($('pp-fix-status'), out);
  }
  // Flipping the toggle immediately re-runs the SAME payload in the new mode.
  const toggle = Rubble.initToggle($('pp-toggle'), () => fixRun(lastPayload));
  makePayloadButtons($('pp-fix-payloads'), fixRun);
  $('pp-fix-current').textContent = lastPayload;

  // "Run on both": the same payload string goes to both versions, side by side.
  $('pp-both').addEventListener('click', () => {
    [['vulnerable', 'pp-both-vuln'], ['fixed', 'pp-both-fixed']].forEach(([mode, id]) => {
      const out = runPayload(lastPayload, mode);
      const body = $(id);
      body.textContent = out.error
        ? out.error.message
        : `guest.isAdmin → ${out.result.guestValue}\n` +
          (out.result.guestIsAdmin ? '⚠ POLLUTED' : '✓ clean');
      body.dataset.result = out.result && out.result.guestIsAdmin ? 'danger' : 'safe';
    });
    $('pp-both-payload').textContent = lastPayload;
  });
  $('pp-fix-clear').addEventListener('click', () => Rubble.clear(fixLog));
});
