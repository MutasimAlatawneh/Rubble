<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-light.svg">
  <img src="assets/logo.svg" alt="Rubble" width="300">
</picture>

# Rubble — Interactive Web Security Sandbox

**Three browser-only labs where you trigger a real web vulnerability, then flip to the fixed code and watch the exact same payload fail.**

**Live site:** https://mutasimalatawneh.github.io/FinalProject/

---

## The labs

| Lab | OWASP Top 10:2021 | CWE | What you see |
|---|---|---|---|
| [Prototype Pollution](lab-prototype-pollution.html) | A08 – Software and Data Integrity Failures | CWE-1321 | One JSON key makes a brand-new `{}` report `isAdmin = true`. |
| [Client-Side Timing Attack](lab-timing-attack.html) | A02 – Cryptographic Failures | CWE-208 | A script rebuilds a hidden secret letter by letter just by timing wrong guesses. |
| [ReDoS](lab-redos.html) | A04 – Insecure Design | CWE-1333 | A ~25-character string makes a username regex freeze the tab. |

Every lab page follows the same six steps: **What it is → The line → Try it → Why it matters → The fix → Sources**.

## What makes it trustworthy

- **The code you read is the code that runs.** Each code block is generated from the real function's source (`fn.toString()`), so the highlighted BUG/FIX line can't drift from what executes.
- **Same payload, both versions.** Payloads are defined once per lab. The Vulnerable/Fixed toggle re-runs the *exact same* payload, and "Run on both" shows the two results side by side.
- **Real fixes.** Fixed mode is blocked by the fixed code itself, not by a special case:
  - `safeMerge()` skips `__proto__`, `constructor` and `prototype`.
  - `safeCheckSecret()` always compares every character (XOR/OR accumulator, no early exit).
  - `/^[a-z0-9]+$/` matches exactly the same usernames as the vulnerable regex, in linear time.

## Safety

Everything runs client-side in your own tab: there's no backend, no login, no storage, no network requests, and no real credentials or personal data.

- **Prototype Pollution:** the attack really pollutes `Object.prototype`. A guard snapshots the built-in prototypes before each run and restores them afterwards, so nothing leaks between runs.
- **Timing Attack:** the secret is random per page load. Each character comparison is **amplified** from ~1 ns to a few milliseconds so the browser's deliberately coarse clock can see it. The page labels this and computes the factor from the code's own constants.
- **ReDoS:** the freeze is real (main thread). The page first calibrates on your device and sizes the attack strings so the worst freeze lasts **≤ 1.5 s**.

## Run it locally

No build step and no dependencies. Either open `index.html` directly, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Project structure

```
index.html                     Home page
lab-prototype-pollution.html   Lab 1
lab-timing-attack.html         Lab 2
lab-redos.html                 Lab 3
styles.css                     Shared design system (CSS variables / brand tokens)
js/common.js                   Shared helpers: code renderer, toggle, logger, run lock
js/lab-*.js                    One script per lab (vulnerable + fixed code + page wiring)
assets/                        Logo, favicons, brand.css (source of the color tokens)
```

## Design

- **Brand tokens.** One shared `styles.css`. Colors come from `assets/brand.css`: brick = brand, red = Vulnerable/BUG, green = Fixed/FIX, amber = AMPLIFIED/SAFETY. In light mode, a few minimally darkened "ink" variants keep every text color at WCAG AA (4.5:1). All pairs were checked in both themes.
- **Themes.** Light and dark mode follow your system setting.
- **Accessibility.** Responsive down to 360 px. Keyboard accessible, with a skip link, visible focus outlines, and focus kept in place during runs. Live regions announce results.

## Tested on

Chrome 148 and Firefox 159 on Linux, driven by an automated click-through of every page, both locally and against the live GitHub Pages site (the deployed files are byte-identical to this repo):

- All three labs, both modes. The same payload succeeds in Vulnerable mode and is blocked in Fixed mode.
- Timing oracle: 48/48 secrets recovered in Vulnerable mode, alone and under CPU load, and 0 recovered in Fixed mode. This holds in Firefox too, even though Firefox only reports time in 1 ms steps.
- ReDoS: worst freeze ≤ 1.5 s after calibration. The fixed regex answers in < 1 ms.
- No console errors, no horizontal scroll at 360 px, WCAG AA contrast in light and dark mode, and fully usable by keyboard.

---

Final project for **42 Amman/Irbid**. All demos are simulations for learning purposes.
