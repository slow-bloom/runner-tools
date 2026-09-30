# Contributing to Runner Tools

Thank you for your interest in contributing to `@slow-bloom/runner-tools`! We welcome bug fixes, algorithm optimizations, new formula implementations, and localization contributions.

---

## Development Prerequisites

- **Node.js**: `>= 20.0.0`
- **npm**: `>= 10.0.0`

---

## Getting Started

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/slow-bloom/runner-tools.git
   cd runner-tools
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the test suite:**
   ```bash
   npm test
   # Or run in interactive watch mode
   npm run test:watch
   ```

4. **Type-check the codebase:**
   ```bash
   npm run typecheck
   ```

5. **Build the packages:**
   ```bash
   npm run build
   ```

The file converter also builds `dist/runner-tools.worker.js`. Do not import that
entry point into a page: it installs a worker message handler. Host it beside the
browser bundle and call `createFileConverterClient()` with its URL.

In the collection checkout, `npm run sync:website` builds and copies both bundles,
their source maps and the MIT license into the English and Chinese websites.
Keep parsing and editing in the shared library; website templates should only
handle controls, localized messages, maps, charts and downloads.

The same seam discipline applies to the remaining interactive tools:

- Track parsing, provenance, resampling, comparison and diagnostics belong in
  `src/files`; Leaflet layers and localized tables stay in website adapters.
- Cadence math, scheduling, synthesis and encoding belong in `src/audio`;
  optional MP3 codecs are injected by callers and never become runtime
  dependencies.
- Workout validation, timelines, timer state and cues belong in `src/timers`;
  storage, file pickers, wake lock and fullscreen stay in the browser adapter.
- Planner arithmetic and calendar serialization belong in `src/formulas`;
  the website only renders returned plan data.

`npm run test:coverage` measures coverage with Vitest's V8 provider. Converter
regressions include source-summary preservation, cropped summaries, FIT developer
identifier remapping, opaque metadata removal during privacy edits, worker errors
and binary transfers through an isolated worker.

Coverage is a regression signal, not a target to game. New and changed behavior
must test meaningful success paths, boundaries, invalid input, state transitions,
and explicit error modes. The project does not require 100% branch coverage when
the remaining branches are defensive fallbacks or generated/runtime-specific
paths that add no additional behavioral confidence.

---

## Architecture & Design Principles

When submitting code to this library, please adhere to these core principles:

1. **Zero Runtime Dependencies**: The core library must remain 100% pure TypeScript without runtime dependencies.
2. **Transparent Numerical Provenance**: All athletic formulas must cite primary scientific or competitive literature (e.g. peer-reviewed sports science, WMA standards).
3. **No Silent Clamping**: Solvers and predictors must check physiological domains and bracket roots. If inputs are unsupported or outside valid ranges, return `null` rather than silently clamping to arbitrary boundaries.
4. **Strict Dual Module Support**: Any exports must maintain strict compatibility with both ES Modules (`dist/index.js`, `dist/index.d.ts`) and CommonJS under TypeScript's `node16` resolution (`dist/index.cjs`, `dist/index.d.cts`).
5. **Localization Contract**: Any user-facing strings or labels must provide fallback to the English dictionary (`enLocale`) and support deep partial overrides.
6. **Explicit File Errors**: The high-level converter throws `FileConversionError` with a stable localization code for invalid input or unsupported edits. Workers must reject failed operations, never return an empty successful download or silently run expensive conversion on the UI thread.
7. **Measurement Provenance**: Never relabel GPS-derived values as device measurements or accuracy ground truth. Estimates and progress alignment must remain explicit in types, docs and UI.
8. **Elapsed-Time State**: Interactive timers must derive state from a monotonic clock, not count interval callbacks. Browser throttling must not create timer drift or burst old audio.
9. **Injected Browser Capabilities**: Web Audio, MP3 encoders, speech, storage, wake lock, fullscreen and clocks enter through callers/adapters. Importing the package must not read browser globals.

---

## Pull Request Checklist

Before submitting a Pull Request, ensure that:

- [ ] All unit tests pass: `npm test`
- [ ] TypeScript checks succeed with zero errors: `npm run typecheck`
- [ ] The build succeeds: `npm run build`
- [ ] The packed ESM, CommonJS, and TypeScript entry points pass: `npm run test:package`
- [ ] New formulas or changes include comprehensive unit tests covering standard values, physiological edges, and invalid/unbracketed inputs.
- [ ] New interactive modules test delayed clocks, cancellation, invalid data and adapter error modes without relying on real time.
- [ ] Documentation and example snippets are updated and adhere to strict null checking.

---

## Versioning Policy

`@slow-bloom/runner-tools` follows [Semantic Versioning 2.0.0](https://semver.org/):

- **During `0.x.y` initial development**:
  - `0.x.0` (minor bump): May introduce breaking API changes, major algorithm revisions, or new core modules.
  - `0.x.y` (patch bump): Backward-compatible bug fixes, performance improvements, and documentation updates.
- **From `1.0.0` onwards**:
  - `MAJOR`: Incompatible API or formula interface modifications.
  - `MINOR`: Backward-compatible new features and algorithms.
  - `PATCH`: Backward-compatible bug fixes.

---

## Security Vulnerabilities

To report a private security vulnerability or flaw, please email **`chenhaomm@sina.com`** directly rather than opening a public issue. We will acknowledge receipt within 48 hours and work with you on a timely resolution.
