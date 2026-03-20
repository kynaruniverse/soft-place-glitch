# Maké — Change Log

## V6  (this release)

### Critical bug fixes

| # | File(s) | Issue | Fix |
|---|---------|-------|-----|
| 1 | `core/state.js` | `filterFavourites` was written directly to `state._data` — bypassing the setter — so the value was never saved to `localStorage`. Filter reset on every refresh. | Added a proper `get filterFavourites` / `set filterFavourites` pair (identical pattern to every other pref). The setter calls `savePrefs({ filterFavourites: v })`. `loadPrefs()` at startup restores it. |
| 2 | `ui/stickies.js` (was `app.js`) | `dragCleanups` and `resizeCleanups` Maps stored cleanup functions that were **never called** when a sticky was deleted. The sticky DOM element was removed but the `document`-level `mousemove` / `touchmove` / `mouseup` / `touchend` listeners from `makeDraggable` / `makeResizable` kept accumulating. | Introduced `_cleanupSticky(id)` which calls both cleanup functions and removes the entries from their Maps. It is called **before** `el.remove()` in the delete handler. |
| 3 | `features/data.js` (was `app.js`) | `importData` called `delete item.id` before `saveItem`, so every re-import of a backup created a duplicate of every item. | Replaced ID deletion with a content-fingerprint deduplication pass. A `_fingerprint(item)` function hashes `layer + type + title + content + code + url + text + language`. Incoming items whose fingerprint already exists in state are skipped with a count shown in the toast. The ID is still stripped so IndexedDB assigns a fresh one, but only after the dedup check. |
| 4 | `core/storage.js` | If `indexedDB.open()` threw (private browsing, quota, broken permissions), the error was caught and logged but the app had no data at all — silently broken. | Added a `localStorage` fallback. A module-level `_usingFallback` flag flips to `true` on the first IndexedDB error. All four public functions (`getAllItems`, `saveItem`, `deleteItem`, `updateItemPosition`) check the flag and route to pure-`localStorage` implementations. A one-time warning toast is shown to the user. |

### PWA fixes

| # | File | Issue | Fix |
|---|------|-------|-----|
| 5 | `manifest.json` | `start_url: "/Make/"` and `scope: "/Make/"` were hardcoded. Deploying to any other path or domain root broke the PWA install entirely. | Changed both to `"."` — relative to wherever the manifest is served from. |
| 6 | `service-worker.js` | Cache name `make-v6` was a hand-typed string. Forgetting to bump it after a deploy silently served stale JS to installed PWA users. | Cache name is now `make-${BUILD_HASH}` where `BUILD_HASH` is computed from the actual file contents by `scripts/build-hash.js`. Without the build script the SW script changing on each deploy is sufficient to trigger a cache bust. |
| 7 | `icons/icon-192.png`, `icons/icon-512.png` | Both files were 42-byte empty stubs. The PWA install prompt showed a broken icon. | Regenerated as real 192×192 and 512×512 PNG files using the app's theme colour (`#9ba59a`) as background with a white "M" lettermark. |

### Refactoring — god-file split

The original `app.js` was ~1,400 lines containing UI logic, rendering, event wiring, editors, modals, and feature code all in one module.  It has been replaced by a **thin orchestrator** (~120 lines) that imports from focused single-responsibility modules:

```
app.js                    ← ~120 lines, boot + shell only

core/
  schema.js               unchanged
  state.js                V3 — filterFavourites fix
  storage.js              V4 — localStorage fallback

utils/
  helpers.js              NEW — esc, parseTags, relativeDate, showToast, icons
  rich-text.js            NEW — execCommand wrapper (isolated for future migration)
  syntax.js               NEW — lightweight syntax highlighter (no build step)
  drag.js                 unchanged
  resize.js               unchanged

ui/
  cards.js                NEW — card grid render + listeners
  stickies.js             NEW — sticky layer render + cleanup fix
  note-editor.js          NEW — rich-text editor + live tag preview
  code-editor.js          NEW — code editor + syntax highlighting
  modals.js               NEW — modal factory, link/sticky/settings/context

features/
  ambient.js              NEW — time-of-day sort
  data.js                 NEW — export / import + dedup fix
  drawer.js               NEW — side drawer + fav-filter fix
  search.js               NEW — search overlay
  sort-menu.js            NEW — sort popup

scripts/
  build-hash.js           NEW — optional deploy tool for automated SW versioning
```

### New feature: syntax highlighting

`utils/syntax.js` implements a zero-dependency, single-pass tokeniser that
supports 16 languages (JS, TS, Python, HTML, CSS, Bash, JSON, SQL, Java, Swift,
Kotlin, Rust, Go, C++, Markdown, plain text).

The code editor uses an **overlay pattern**: a transparent `<textarea>` sits on
top of a `<pre>` mirror.  The `<pre>` renders highlighted HTML; the `<textarea>`
handles all input and shows the real cursor and selection.  No `contenteditable`,
no `execCommand`, no external library.

### New feature: live tag preview

In the note editor, `#hashtag` chips are now rendered in a preview strip below
the toolbar **as you type**, not only after you press Save.  `parseTags` is
called on every `input` event on the editor body.

### execCommand isolation

All `document.execCommand()` calls in the note editor are now routed through
`utils/rich-text.js`.  The module:
- Documents the deprecation clearly with a migration path comment.
- Provides manual `Selection` / `Range` fallbacks for `bold`, `italic`,
  `underline`, `strikeThrough`, `foreColor`, `fontSize`, and `formatBlock`
  — used automatically if the browser throws on `execCommand`.
- Is a single-file swap point when `execCommand` is finally removed.

---

### Known remaining limitations

- **Rich text editor**: the underlying mechanism (`document.execCommand`) is
  still deprecated. The manual fallbacks cover the most common commands but
  complex list / indent operations still depend on browser support. A future
  version should adopt Trix or a minimal ProseMirror setup.
- **Code editor syntax highlighting**: the tokeniser is regex-based and single-
  pass. It handles the common cases well but will occasionally mis-colour
  complex nested strings or template literals. A future version could use a
  proper parse-tree approach.
- **Icons**: the generated icons are functional but minimal. Replace
  `icons/icon-192.png` and `icons/icon-512.png` with your own artwork for a
  polished home-screen appearance.
