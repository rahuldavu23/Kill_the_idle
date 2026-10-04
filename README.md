# Present Flow

Rama, and the day in front of you. A desk companion: two standing lists, one
ordered plan for today, and someone to talk to about it.

## Running it

```bash
npm install
npm run app        # the desktop widget (Tauri) — what this is meant to be
npm run dev        # the same app in a browser tab, for quick iteration
npm run app:build  # a real installer in src-tauri/target/release/bundle/nsis
```

`npm run app` needs the Rust toolchain and the MSVC build tools; `npm run dev`
needs neither. Everything else — lint, typecheck, build — is frontend only.

## The widget

The window is frameless, so the app draws its own titlebar: drag it anywhere,
`Top` pins it above other windows, `×` quits outright — nothing is left
running in the background, and you start it again from its own icon.

While it is running it also sits in the system tray:

- **left click** — show or hide the window
- **right click** — always on top, launch at login, quit

Quitting is safe at any moment: the day is written to storage as it is edited,
never on the way out.

## What it remembers

Three kinds of thing, and the difference between the first two is the point:

| | Lives for | New day |
|---|---|---|
| **Projects** | Until ticked off or deleted | Untouched — carried forward, showing how long it has waited |
| **Today** | One calendar day | Starts empty; the old day is kept and can still be ticked off |
| **Enjoy** | Until deleted | Untouched |

Use the `◀ ▶` arrows above the bottom panel to read back through earlier days.
A past day can still be ticked off, but not added to — new work belongs to the
day you are actually in. Roughly a year of days is kept.

## Where the data is

One JSON document under the key `present-flow.data`, written on every change
and read once on open. In the desktop app that is the WebView2 store inside
`%LOCALAPPDATA%\com.rahul.presentflow`; in a browser tab it is that origin's
local storage, so **the tab and the app do not share a list.**

[`src/data/store.ts`](src/data/store.ts) is the only file that touches
persistence. Its backend is a seam (`setBackend`) so a plain file on disk can
replace local storage without the rest of the app noticing, and `exportJson`
produces a readable snapshot worth keeping before any reinstall. Stored text is
treated as untrusted on the way in: anything unreadable is dropped rather than
allowed to fail the load, so an older or hand-edited document still opens.

## Layout

The window's vertical budget is divided in
[`src/App.css`](src/App.css): `--chrome` is the titlebar (0 in a browser tab),
`--bubble-reserve` is headroom for Rama's longest line, and `--today-reserve`
is what the plan may take from what is left. They live together at the top of
the file so they cannot drift apart from each other.

## Rama

[`src/data/chat.ts`](src/data/chat.ts) matches what you type against the
intents in [`src/data/dialogue.ts`](src/data/dialogue.ts) and answers from a
bank of lines, avoiding ones used recently and going deeper when you stay on a
subject. It is entirely local — no model, no network. `chat.reply` is async so
a real one could be dropped in behind the same call.
