# Worth It

A private, local-first spending tracker for Android that pairs every
transaction with *how it felt* to spend it — not just what it cost.

## The one-paragraph version

Worth It is a budgeting app built around a simple idea: raw numbers don't
change behavior, but noticing patterns does. Every time you log a spend,
you tag it with a "vibe" — Joyful, Necessary, Impulsive, or Regret — so
over time the app can show you not just where your money goes, but
whether it's going somewhere you're actually glad about.

## Core features

- **Ghost Mode** — no accounts, no sign-up, no server. Every transaction
  and setting lives only in the app's local storage on your phone.
  Nothing is ever sent anywhere.
- **Quick-add with auto-category detection** — start typing a transaction
  title ("uber to town") and it recognizes the category on its own.
- **Purchase Vibe tagging** — a mandatory one-tap emotional tag on every
  transaction (Joyful / Necessary / Impulsive / Regret), which is what
  makes this different from a generic expense tracker.
- **Split transactions** — divide a shared cost and log either your share
  or the full amount.
- **Category budgets with rollover** — set a monthly ceiling per
  category; unspent budget from a month you actually tracked carries
  forward automatically.
- **Vibe Recap** — a monthly comparison showing which vibe dominated your
  spending and how it's shifted from the month before.
- **Edit and delete** — tap any transaction to correct or remove it.
- **Smart daily reminder** — an optional, time-scheduled nudge to log
  today's spending, with its own custom notification sound. The message
  adapts depending on whether you've already logged something that day.
- **Export/Import** — back up all your data as a JSON file through
  Android's native share sheet, or restore from a backup.
- **Three-tab layout** — Home (overview + burn rate), Budgets (per-category
  detail), and Ledger (the full transaction history), so nothing lives on
  one long scrolling page.

## How it's built

- **React** (single-file component architecture) + **Tailwind CSS** for
  the UI
- **Capacitor** wraps it as a native Android app
- **Capacitor Local Notifications** for the reminder system
- **Capacitor Filesystem + Share** for native export
- Entirely offline — no backend, no API calls, no analytics

## Philosophy

Everything about the app's design traces back to one constraint: it
never needed a server to do its job. Budgets, rollovers, vibe tracking,
reminders, backups — all of it works entirely on-device, which is also
why there's no login screen and no data ever leaves your phone unless
you explicitly export it yourself.

