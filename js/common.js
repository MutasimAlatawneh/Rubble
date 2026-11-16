/* ==========================================================================
   Rubble — shared helpers used by every lab page
   --------------------------------------------------------------------------
   Everything lives inside one object, `Rubble`, so lab scripts can call
   e.g. Rubble.renderCode(...) without polluting the global scope.
   ========================================================================== */
'use strict';

const Rubble = (() => {

  /* Turn text into HTML-safe text (so "<" shows up as "<", not as a tag). */
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Get a function's real source code, with the common indentation removed.
     This is the key honesty trick of the sandbox: the code you SEE on the
     page is produced from the very function the page RUNS. */
  function getSource(fn) {
    const lines = fn.toString().split('\n');
    // The first line ("function x() {") has no indent; look at the rest.
    const indents = lines.slice(1)
      .filter(l => l.trim() !== '')
      .map(l => l.match(/^ */)[0].length);
    const cut = indents.length ? Math.min(...indents) : 0;
    return [lines[0], ...lines.slice(1).map(l => l.slice(cut))].join('\n');
  }

  /* Render one or more functions into a <code> element, one <span> per line.
     Lines whose comment contains "BUG:" or "FIX:" get highlighted.
       codeEl : the <code> element to fill
       fns    : a function, or an array of functions (joined by a blank line)
  */
  function renderCode(codeEl, fns) {
    const list = Array.isArray(fns) ? fns : [fns];
    const source = list.map(getSource).join('\n\n');

    codeEl.innerHTML = source.split('\n').map(line => {
      let cls = 'line';
      if (/\/\/ BUG:/.test(line)) cls += ' is-bug';
      if (/\/\/ FIX:/.test(line)) cls += ' is-fix';
      // Dim comments a little so the code itself stands out.
      const html = escapeHtml(line).replace(/(\/\/.*)$/, '<span class="comment">$1</span>');
      return `<span class="${cls}">${html || ' '}</span>`;
    }).join('');
  }

  /* Wire up a Vulnerable / Fixed toggle.
     groupEl must contain <button data-mode="vulnerable"> and <button data-mode="fixed">.
     Returns an object whose .mode is always the current choice. */
  function initToggle(groupEl, onChange) {
    const buttons = [...groupEl.querySelectorAll('button[data-mode]')];
    const state = { mode: 'vulnerable' };

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        state.mode = btn.dataset.mode;
        buttons.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
        groupEl.dataset.mode = state.mode;
        if (onChange) onChange(state.mode);
      });
    });
    return state;
  }

  /* Append one line to an output console.
     kind: 'info' | 'danger' | 'safe' | 'warn' | 'muted' */
  function log(consoleEl, text, kind = 'info') {
    const line = document.createElement('div');
    line.className = `log log--${kind}`;
    line.textContent = text;
    consoleEl.append(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  function clear(consoleEl) {
    consoleEl.textContent = '';
  }

  /* Wait until the browser has actually painted the screen.
     Use this before heavy work so "Running…" appears first. */
  function nextPaint() {
    return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }

  /* Render every <code data-source="name"> on the page from a map of functions.
     Example: Rubble.renderAll({ vulnerable: merge, fixed: safeMerge }) */
  function renderAll(map) {
    document.querySelectorAll('code[data-source]').forEach(el => {
      const names = el.dataset.source.split(',').map(s => s.trim());
      const fns = names.map(n => map[n]).filter(Boolean);
      if (fns.length) renderCode(el, fns);
    });
  }

  /* Run an async task with every lab button disabled, so runs never overlap.
     Disabling the button that has keyboard focus would drop focus back to
     the top of the page, so we put focus back where it was afterwards. */
  let running = false;
  async function exclusive(task, selector = '#try button, #fix button') {
    if (running) return;
    running = true;
    const focused = document.activeElement;
    const controls = document.querySelectorAll(selector);
    controls.forEach(b => (b.disabled = true));
    try {
      await task();
    } finally {
      controls.forEach(b => (b.disabled = false));
      running = false;
      if (focused && focused !== document.body && document.contains(focused)) focused.focus();
    }
  }

  /* Scrollable areas (code blocks, consoles) must be reachable by keyboard,
     otherwise keyboard users can't scroll to see the highlighted line. */
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.code pre, .console').forEach(el => {
      el.tabIndex = 0;
      if (!el.hasAttribute('aria-label')) {
        el.setAttribute('aria-label', el.matches('pre') ? 'Code (scrollable)' : 'Output log');
      }
    });
  });

  return { escapeHtml, getSource, renderCode, renderAll, initToggle, log, clear, nextPaint, exclusive };
})();
