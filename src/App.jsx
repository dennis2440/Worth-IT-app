/**
 * WORTH IT
 * A hyper-modern, private, local-first financial tracker.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  Settings,
  X,
  Plus,
  Wallet,
  Download,
  Upload,
  Trash2,
  Check,
  ChevronRight,
  ChevronDown,
  Users,
  User,
  Flame,
  Calendar,
  Filter,
  AlertCircle,
  Ghost,
  Banknote,
  Tag,
  Sparkles,
  Utensils,
  Car,
  Home,
  ShoppingBag,
  PartyPopper,
  Zap,
  ShieldCheck,
  Undo2,
  Bell,
  PieChart,
  Receipt,
  ArrowUp,
  ArrowDown,
  Pencil,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────── *
 *  CONSTANTS
 * ────────────────────────────────────────────────────────────────────── */

const STORAGE_KEYS = {
  transactions: "worthit_transactions_v2",
  settings: "worthit_settings_v2",
};

const CATEGORIES = [
  {
    id: "food",
    label: "Food & Drinks",
    icon: Utensils,
    color: "#34d399",
    keywords: [
      "lunch", "dinner", "breakfast", "supper", "groceries", "coffee", "food", "java",
      "snacks", "restaurant", "drinks", "supermarket", "meat", "butchery", "kfc", 
      "takeout", "cafe", "fastfood", "water", "milk"
    ],
  },
  {
    id: "transport",
    label: "Transport",
    icon: Car,
    color: "#38bdf8",
    keywords: [
      "matatu", "uber", "bolt", "fuel", "cab", "ride", "bus", "petrol",
      "boda", "bodaboda", "fare", "parking", "diesel", "carwash", "service", 
      "mechanic", "flight", "train", "sgr", "toll"
    ],
  },
  {
    id: "bills",
    label: "Bills & Rent",
    icon: Home,
    color: "#fbbf24",
    keywords: [
      "rent", "wifi", "token", "power", "airtime", "bill", "electricity",
      "kplc", "internet", "water", "garbage", "service charge", "subscription", 
      "netflix", "dstv", "spotify", "bundle", "data"
    ],
  },
  {
    id: "shopping",
    label: "Shopping & Personal",
    icon: ShoppingBag,
    color: "#e879f9",
    keywords: [
      "clothes", "shoes", "haircut", "phone", "electronics", "shopping",
      "salon", "barber", "skincare", "makeup", "chemist", "pharmacy", 
      "clothes", "gadgets", "appliances", "perfume", "accessories"
    ],
  },
  {
    id: "fun",
    label: "Fun & Entertainment",
    icon: PartyPopper,
    color: "#a78bfa",
    keywords: [
      "movie", "party", "drink", "game", "club", "concert", "fun",
      "alcohol", "beer", "outing", "vacation", "trip", "event", 
      "cinema", "gaming", "bet", "sportpesa", "shisha", "lounge"
    ],
  },
];

const VIBES = [
  { id: "joyful", label: "Joyful", icon: Sparkles, color: "#34d399", desc: "High-value, genuine happiness" },
  { id: "necessary", label: "Necessary", icon: ShieldCheck, color: "#94a3b8", desc: "Bills, rent, essential obligations" },
  { id: "impulsive", label: "Impulsive", icon: Zap, color: "#fb923c", desc: "Quick dopamine hit, spontaneous spend" },
  { id: "regret", label: "Regret", icon: Undo2, color: "#fb7185", desc: "Instantly wished you hadn't spent it" },
];

const CURRENCIES = [
  { symbol: "KSh", label: "KSh — Kenyan Shilling" },
  { symbol: "$", label: "$ — US Dollar" },
  { symbol: "£", label: "£ — British Pound" },
  { symbol: "€", label: "€ — Euro" },
  { symbol: "₦", label: "₦ — Nigerian Naira" },
  { symbol: "R", label: "R — South African Rand" },
  { symbol: "₹", label: "₹ — Indian Rupee" },
  { symbol: "¥", label: "¥ — Yen / Yuan" },
];

const DEFAULT_SETTINGS = {
  userName: "",
  currency: "KSh",
  reminderEnabled: false,
  reminderTime: "20:00",
  budgets: { food: 0, transport: 0, bills: 0, shopping: 0, fun: 0 },
};

/* ────────────────────────────────────────────────────────────────────── *
 *  HELPERS
 * ────────────────────────────────────────────────────────────────────── */

const catById = (id) => CATEGORIES.find((c) => c.id === id);
const vibeById = (id) => VIBES.find((v) => v.id === id);

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function detectCategory(title) {
  const t = title.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((kw) => t.includes(kw))) return cat.id;
  }
  return null;
}

function formatMoney(amount, settings) {
  const rounded = Math.round(amount * 100) / 100;
  const hasDecimals = Math.abs(rounded % 1) > 0.001;
  return `${settings.currency}${rounded.toLocaleString(undefined, {
    maximumFractionDigits: hasDecimals ? 2 : 0,
    minimumFractionDigits: 0,
  })}`;
}

function relativeDateLabel(dateStr) {
  const today = isoDate(new Date());
  const yest = isoDate(new Date(Date.now() - 86400000));
  if (dateStr === today) return "Today";
  if (dateStr === yest) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* ────────────────────────────────────────────────────────────────────── *
 *  DAILY REMINDER (local notification — native Android only)
 *  Always fires at the chosen time — never skips the day entirely, since
 *  logging one thing doesn't mean there's nothing left to log. The
 *  message just adapts depending on whether anything's been logged yet.
 *  Silently no-ops in the browser dev preview (no native bridge there).
 * ────────────────────────────────────────────────────────────────────── */

const REMINDER_ID = 987654;
const REMINDER_CHANNEL_ID = "worth-it-reminders";
const REMINDER_BODY_NOTHING_LOGGED = "Today's spending is still a ghost 👻 — log it before it disappears.";
const REMINDER_BODY_SOMETHING_LOGGED = "Logged something today — anything else before it disappears?";

async function ensureNotificationPermission() {
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === "granted") return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  } catch {
    return false;
  }
}

async function ensureReminderChannel() {
  try {
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: "Daily reminder",
      description: "The daily nudge to log today's spending",
      importance: 5,
      visibility: 1,
      sound: "worth_it_chime.wav",
    });
  } catch {
    // channel creation isn't available on all platforms/versions — fine to no-op
  }
}

async function scheduleReminder(settings, transactions) {
  if (!Capacitor.isNativePlatform()) return; // no native bridge in browser dev preview
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
    if (!settings.reminderEnabled) return;

    const granted = await ensureNotificationPermission();
    if (!granted) return;

    await ensureReminderChannel();

    const [h, m] = (settings.reminderTime || "20:00").split(":").map(Number);
    const now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    if (target <= now) {
      target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
      target.setHours(h, m, 0, 0);
    }

    const loggedToday = transactions.some((t) => t.date === isoDate(now));
    const body = loggedToday ? REMINDER_BODY_SOMETHING_LOGGED : REMINDER_BODY_NOTHING_LOGGED;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: REMINDER_ID,
          title: "Worth It",
          body,
          channelId: REMINDER_CHANNEL_ID,
          schedule: { at: target },
        },
      ],
    });
  } catch {
    // best-effort — never let a notification failure break the app
  }
}

/* ────────────────────────────────────────────────────────────────────── *
 *  GLOBAL STYLES (fonts, scrollbars, keyframes, safe-area helpers)
 * ────────────────────────────────────────────────────────────────────── */

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

      html, body {
        background-color: #0f172a;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        overscroll-behavior-y: none;
      }
      * { font-family: 'Inter', system-ui, sans-serif; }
      .font-display { font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif; }

      ::-webkit-scrollbar { display: none; }
      * { scrollbar-width: none; -ms-overflow-style: none; }

      @keyframes vl-sheet-up {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      @keyframes vl-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes vl-pop {
        0% { opacity: 0; transform: translateY(6px) scale(0.98); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      .vl-sheet-anim { animation: vl-sheet-up 320ms cubic-bezier(0.32, 0.72, 0, 1); }
      .vl-backdrop-anim { animation: vl-fade-in 220ms ease; }
      .vl-pop-anim { animation: vl-pop 380ms cubic-bezier(0.16, 1, 0.3, 1); }
    `}</style>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  SMALL UI PRIMITIVES
 * ────────────────────────────────────────────────────────────────────── */

function ProgressBar({ pct, color, trackClass = "bg-white/[0.07]" }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={`h-2 w-full rounded-full overflow-hidden ${trackClass}`}>
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
}

function IconButton({ onClick, children, label, className = "" }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full bg-white/[0.06] active:bg-white/[0.14] active:scale-95 transition-all ${className}`}
    >
      {children}
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  HEADER
 * ────────────────────────────────────────────────────────────────────── */

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Header({ onOpenSettings, userName }) {
  const hasName = userName && userName.trim().length > 0;
  return (
    <header
      className="sticky top-0 z-30 bg-[#0f172a]/85 backdrop-blur-xl border-b border-white/[0.06]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="max-w-md mx-auto px-4 pt-4 pb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-700 tracking-tight text-white">Worth It</h1>
          {hasName ? (
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {getGreeting()}, <span className="text-emerald-400/90">{userName.trim()}</span>
            </p>
          ) : (
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-emerald-400/80 font-medium">
              <Ghost size={12} strokeWidth={2.5} />
              <span>Ghost Mode · on this device only</span>
            </div>
          )}
        </div>
        <IconButton onClick={onOpenSettings} label="Settings">
          <Settings size={20} className="text-slate-300" />
        </IconButton>
      </div>
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  HERO SUMMARY
 * ────────────────────────────────────────────────────────────────────── */

function HeroSummary({ totalSpent, totalBudget, burnPct, budgetPct, settings }) {
  const over = budgetPct > burnPct + 5;
  const under = budgetPct < burnPct - 5;
  const barColor = over ? "#fb7185" : under ? "#34d399" : "#fbbf24";

  return (
    <section className="mt-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Spent this month</p>
      <div className="mt-1">
        <span className="font-display text-4xl font-700 text-white">{formatMoney(totalSpent, settings)}</span>
      </div>
      <p className="text-sm text-slate-500 mt-1">
        of {formatMoney(totalBudget, settings)} budgeted (incl. rollover)
      </p>

      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <Flame size={13} className="text-orange-400" />
            Burn rate
          </div>
          <span className="text-xs text-slate-400">
            {budgetPct.toFixed(0)}% spent · {burnPct.toFixed(0)}% of month gone
          </span>
        </div>
        <div className="relative h-2 w-full rounded-full bg-white/[0.07] overflow-hidden">
          <div
            className="absolute top-0 bottom-0 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, budgetPct)}%`, backgroundColor: barColor }}
          />
          <div className="absolute top-0 bottom-0 w-[2px] bg-white/60" style={{ left: `${Math.min(100, burnPct)}%` }} />
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">
          {over ? "Spending faster than the month is passing." : under ? "Pacing under the month — nice control." : "Right on pace."}
        </p>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  CATEGORY BUDGETS
 * ────────────────────────────────────────────────────────────────────── */

function CategoryBudgets({ categorySpend, budgets, rollovers, settings, activeFilter, onFilter }) {
  return (
    <section className="mt-5">
      <h2 className="text-sm font-semibold text-slate-300 mb-2.5 px-0.5">Budgets by category</h2>
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] divide-y divide-white/[0.06] overflow-hidden">
        {CATEGORIES.map((cat) => {
          const spent = categorySpend[cat.id] || 0;
          const base = Number(budgets[cat.id]) || 0;
          const rollover = rollovers[cat.id] || 0;
          const effective = base + rollover;
          const pct = effective > 0 ? (spent / effective) * 100 : spent > 0 ? 100 : 0;
          const isActive = activeFilter?.type === "category" && activeFilter.id === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onFilter(isActive ? null : { type: "category", id: cat.id })}
              className={`w-full text-left px-4 py-3.5 min-h-[48px] transition-colors ${
                isActive ? "bg-emerald-400/[0.08]" : "active:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cat.color}22` }}
                  >
                    <cat.icon size={14} style={{ color: cat.color }} strokeWidth={2.25} />
                  </span>
                  <span className="text-sm font-medium text-slate-200">{cat.label}</span>
                  {isActive && <Check size={13} className="text-emerald-400" />}
                </div>
                <span className="text-sm font-medium text-slate-300 font-display">
                  {formatMoney(spent, settings)}
                  <span className="text-slate-500"> / {formatMoney(effective, settings)}</span>
                </span>
              </div>
              <ProgressBar pct={pct} color={pct > 100 ? "#fb7185" : cat.color} />
              {rollover > 0 && (
                <p className="text-[11px] text-emerald-400/80 mt-1">
                  +{formatMoney(rollover, settings)} rolled over from last month
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  VIBE INSIGHTS
 * ────────────────────────────────────────────────────────────────────── */

function VibeInsights({ vibeSpend, totalSpent, activeFilter, onFilter }) {
  const topVibe = useMemo(() => {
    const entries = Object.entries(vibeSpend).sort((a, b) => b[1] - a[1]);
    return entries.length && entries[0][1] > 0 ? entries[0] : null;
  }, [vibeSpend]);

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <h2 className="text-sm font-semibold text-slate-300">Spending by vibe</h2>
        {topVibe && (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            {Math.round((topVibe[1] / (totalSpent || 1)) * 100)}% went to {vibeById(topVibe[0]).label.toLowerCase()}
            {React.createElement(vibeById(topVibe[0]).icon, {
              size: 12,
              style: { color: vibeById(topVibe[0]).color },
            })}
          </span>
        )}
      </div>
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] divide-y divide-white/[0.06] overflow-hidden">
        {VIBES.map((v) => {
          const amt = vibeSpend[v.id] || 0;
          const pct = totalSpent > 0 ? (amt / totalSpent) * 100 : 0;
          const isActive = activeFilter?.type === "vibe" && activeFilter.id === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onFilter(isActive ? null : { type: "vibe", id: v.id })}
              className={`w-full text-left px-4 py-3 min-h-[48px] transition-colors ${
                isActive ? "bg-emerald-400/[0.08]" : "active:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-[1.5px] bg-transparent"
                    style={{ borderColor: `${v.color}66` }}
                  >
                    <v.icon size={13} style={{ color: v.color }} strokeWidth={2.25} />
                  </span>
                  <span className="text-sm font-medium text-slate-200">{v.label}</span>
                  {isActive && <Check size={13} className="text-emerald-400" />}
                </div>
                <span className="text-sm font-medium text-slate-300 font-display">{pct.toFixed(0)}%</span>
              </div>
              <ProgressBar pct={pct} color={v.color} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  VIBE RECAP (Home tab — this month vs last month, at a glance)
 * ────────────────────────────────────────────────────────────────────── */

function VibeRecap({ vibeSpend, totalSpent, prevVibeSpend, prevTotalSpent }) {
  const hasPrevData = prevTotalSpent > 0;

  const topVibe = useMemo(() => {
    const entries = Object.entries(vibeSpend).sort((a, b) => b[1] - a[1]);
    return entries.length && entries[0][1] > 0 ? entries[0] : null;
  }, [vibeSpend]);

  return (
    <section className="mt-5">
      <h2 className="text-sm font-semibold text-slate-300 mb-2.5 px-0.5">Vibe recap</h2>
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
        {topVibe ? (
          <p className="text-sm text-slate-200 mb-3.5">
            <span style={{ color: vibeById(topVibe[0]).color }} className="font-semibold">
              {vibeById(topVibe[0]).label}
            </span>{" "}
            led the month at{" "}
            <span className="font-display font-semibold text-white">
              {Math.round((topVibe[1] / (totalSpent || 1)) * 100)}%
            </span>
          </p>
        ) : (
          <p className="text-sm text-slate-500 mb-3.5">No spending logged yet this month.</p>
        )}

        <div className="space-y-2.5">
          {VIBES.map((v) => {
            const curPct = totalSpent > 0 ? (vibeSpend[v.id] / totalSpent) * 100 : 0;
            const prevPct = hasPrevData ? (prevVibeSpend[v.id] / prevTotalSpent) * 100 : null;
            const delta = prevPct !== null ? curPct - prevPct : null;
            const showDelta = delta !== null && Math.abs(delta) >= 1;
            return (
              <div key={v.id} className="flex items-center gap-2.5">
                <v.icon size={14} style={{ color: v.color }} strokeWidth={2.25} />
                <span className="text-xs text-slate-300 flex-1">{v.label}</span>
                <span className="text-xs font-medium text-slate-200 font-display">{curPct.toFixed(0)}%</span>
                {showDelta && (
                  <span className="flex items-center gap-0.5 text-[11px] font-medium" style={{ color: v.color }}>
                    {delta > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                    {Math.abs(delta).toFixed(0)}pt
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {!hasPrevData && (
          <p className="text-[11px] text-slate-500 mt-3.5 pt-3 border-t border-white/[0.06]">
            Not enough history yet for a month-over-month comparison — check back next month.
          </p>
        )}
      </div>
    </section>
  );
}
/* ────────────────────────────────────────────────────────────────────── *
 *  FILTER CHIP
 * ────────────────────────────────────────────────────────────────────── */

function FilterChip({ filter, onClear }) {
  if (!filter) return null;
  const entity = filter.type === "category" ? catById(filter.id) : vibeById(filter.id);
  return (
    <div className="mt-4 flex items-center gap-2">
      <div className="flex items-center gap-1.5 bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 text-xs font-medium px-3 py-1.5 rounded-full">
        <Filter size={11} />
        <entity.icon size={12} />
        {entity.label}
      </div>
      <button onClick={onClear} className="text-xs text-slate-500 underline underline-offset-2 min-h-[32px] px-1">
        Clear
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  TRANSACTION LIST
 * ────────────────────────────────────────────────────────────────────── */

function TransactionRow({ tx, settings, onEdit }) {
  const cat = catById(tx.categoryId);
  const vibe = vibeById(tx.vibeId);
  return (
    <button
      onClick={() => onEdit?.(tx)}
      className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left active:bg-white/[0.04] transition-colors"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${cat.color}22` }}
      >
        <cat.icon size={17} style={{ color: cat.color }} strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-slate-100 truncate">{tx.title}</p>
          <span
            className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 border-[1.5px] bg-transparent"
            style={{ borderColor: `${vibe.color}66` }}
          >
            <vibe.icon size={9} style={{ color: vibe.color }} strokeWidth={2.75} />
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
          <span>{cat.label}</span>
          {tx.isSplit && (
            <span className="flex items-center gap-0.5 text-slate-500">
              <Users size={10} />÷{tx.splitCount}
            </span>
          )}
        </div>
      </div>
      <span className="text-sm font-semibold text-slate-100 font-display shrink-0">
        {formatMoney(tx.amount, settings)}
      </span>
    </button>
  );
}

function TransactionList({ transactions, settings, onOpenAdd, onEditTransaction, hasFilter }) {
  const grouped = useMemo(() => {
    const map = {};
    for (const tx of transactions) {
      if (!map[tx.date]) map[tx.date] = [];
      map[tx.date].push(tx);
    }
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <section className="mt-8 flex flex-col items-center text-center py-10 px-6">
        <Sparkles size={28} className="text-slate-600 mb-3" />
        <p className="text-sm font-medium text-slate-300">{hasFilter ? "No moves here" : "Nothing logged yet"}</p>
        <p className="text-xs text-slate-500 mt-1">
          {hasFilter ? "Try clearing the filter, or log something new." : "Tap + to add your first spend."}
        </p>
        <button
          onClick={onOpenAdd}
          className="mt-4 text-xs font-semibold text-emerald-400 min-h-[44px] px-4 rounded-full border border-emerald-400/30"
        >
          Add a transaction
        </button>
      </section>
    );
  }

  return (
    <section className="mt-5 mb-4">
      <h2 className="text-sm font-semibold text-slate-300 mb-2.5 px-0.5">Ledger</h2>
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
        {grouped.map(([date, txs], gi) => (
          <div key={date}>
            <div className={`px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-white/[0.02] ${gi > 0 ? "border-t border-white/[0.06]" : ""}`}>
              {relativeDateLabel(date)}
            </div>
            <div className="divide-y divide-white/[0.05]">
              {txs.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} settings={settings} onEdit={onEditTransaction} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  SHEET WRAPPER (bottom sheet modal)
 * ────────────────────────────────────────────────────────────────────── */

function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 vl-backdrop-anim" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-[#0f172a] border-t border-white/10 rounded-t-3xl vl-sheet-anim max-h-[88vh] flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.06] shrink-0">
          <h2 className="font-display text-lg font-700 text-white">{title}</h2>
          <IconButton onClick={onClose} label="Close">
            <X size={18} className="text-slate-300" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 pt-4 pb-6">{children}</div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  QUICK ADD SHEET
 * ────────────────────────────────────────────────────────────────────── */

function QuickAddSheet({ onClose, onSave, onDelete, settings, initialTx }) {
  const isEditing = !!initialTx;

  const [title, setTitle] = useState(initialTx?.title ?? "");
  const [amount, setAmount] = useState(initialTx ? String(initialTx.rawAmount ?? initialTx.amount) : "");
  const [categoryId, setCategoryId] = useState(initialTx?.categoryId ?? null);
  const [categoryLocked, setCategoryLocked] = useState(isEditing);
  const [date, setDate] = useState(initialTx?.date ?? isoDate(new Date()));
  const [vibeId, setVibeId] = useState(initialTx?.vibeId ?? null);
  const [isSplit, setIsSplit] = useState(initialTx?.isSplit ?? false);
  const [splitCount, setSplitCount] = useState(initialTx?.splitCount ?? 2);
  const [splitMode, setSplitMode] = useState(initialTx?.splitMode ?? "share");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (categoryLocked) return;
    const detected = detectCategory(title);
    if (detected) setCategoryId(detected);
  }, [title, categoryLocked]);

  const amountNum = parseFloat(amount) || 0;
  const perShare = splitCount > 0 ? amountNum / splitCount : amountNum;
  const finalAmount = isSplit ? (splitMode === "share" ? perShare : amountNum) : amountNum;
  const canSave = title.trim().length > 0 && amountNum > 0 && categoryId && vibeId && date;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: initialTx?.id ?? uid(),
      title: title.trim(),
      amount: Math.round(finalAmount * 100) / 100,
      rawAmount: amountNum,
      categoryId,
      vibeId,
      date,
      isSplit,
      splitCount: isSplit ? splitCount : null,
      splitMode: isSplit ? splitMode : null,
    });
  };

  return (
    <Sheet title={isEditing ? "Edit spend" : "Log a spend"} onClose={onClose}>
      <div className="space-y-5">
        {/* Title */}
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">What was it?</label>
          <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3.5 min-h-[48px]">
            <Tag size={16} className="text-slate-500 shrink-0" />
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Uber to town"
              className="bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-600 w-full py-3"
            />
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Amount ({settings.currency})</label>
          <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3.5 min-h-[48px]">
            <Banknote size={16} className="text-slate-500 shrink-0" />
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              className="bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-600 w-full py-3 font-display"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">
            Category {!categoryLocked && title && categoryId && <span className="text-emerald-400">· auto-detected</span>}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => {
              const active = categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setCategoryId(cat.id);
                    setCategoryLocked(true);
                  }}
                  className={`min-h-[48px] flex items-center gap-2 px-3 rounded-xl border text-sm font-medium transition-colors active:scale-[0.98] ${
                    active
                      ? "border-emerald-400/60 bg-emerald-400/[0.12] text-emerald-300"
                      : "border-white/[0.1] bg-white/[0.04] text-slate-300"
                  }`}
                >
                  <cat.icon size={16} style={{ color: active ? "#34d399" : cat.color }} strokeWidth={2.25} />
                  <span className="truncate text-left leading-tight">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Date</label>
          <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3.5 min-h-[48px]">
            <Calendar size={16} className="text-slate-500 shrink-0" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent outline-none text-sm text-slate-100 w-full py-3 [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Vibe */}
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Purchase vibe (required)</label>
          <div className="grid grid-cols-4 gap-2">
            {VIBES.map((v) => {
              const active = vibeId === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setVibeId(v.id)}
                  className={`min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl border transition-colors active:scale-[0.98] ${
                    active ? "border-emerald-400/60 bg-emerald-400/[0.12]" : "border-white/[0.1] bg-white/[0.04]"
                  }`}
                >
                  <v.icon size={19} style={{ color: active ? "#34d399" : v.color }} strokeWidth={2.25} />
                  <span className={`text-[10px] font-medium ${active ? "text-emerald-300" : "text-slate-400"}`}>{v.label}</span>
                </button>
              );
            })}
          </div>
          {vibeId && <p className="text-[11px] text-slate-500 mt-1.5">{vibeById(vibeId).desc}</p>}
        </div>

        {/* Split */}
        <div className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-3.5">
          <button
            onClick={() => setIsSplit((s) => !s)}
            className="w-full flex items-center justify-between min-h-[44px]"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Users size={15} className="text-slate-400" />
              Split transaction
            </span>
            <div
              className={`w-11 h-6 rounded-full transition-colors relative ${isSplit ? "bg-emerald-400" : "bg-white/[0.15]"}`}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{ transform: isSplit ? "translateX(22px)" : "translateX(2px)" }}
              />
            </div>
          </button>

          {isSplit && (
            <div className="mt-3 pt-3 border-t border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Split between how many people?</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSplitCount((n) => Math.max(2, n - 1))}
                    className="w-8 h-8 rounded-full bg-white/[0.08] text-slate-200 flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="text-sm font-semibold text-slate-100 w-4 text-center font-display">{splitCount}</span>
                  <button
                    onClick={() => setSplitCount((n) => Math.min(20, n + 1))}
                    className="w-8 h-8 rounded-full bg-white/[0.08] text-slate-200 flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSplitMode("share")}
                  className={`flex-1 min-h-[40px] rounded-lg text-xs font-medium border ${
                    splitMode === "share" ? "border-emerald-400/60 bg-emerald-400/[0.12] text-emerald-300" : "border-white/[0.1] text-slate-400"
                  }`}
                >
                  Log my share
                </button>
                <button
                  onClick={() => setSplitMode("total")}
                  className={`flex-1 min-h-[40px] rounded-lg text-xs font-medium border ${
                    splitMode === "total" ? "border-emerald-400/60 bg-emerald-400/[0.12] text-emerald-300" : "border-white/[0.1] text-slate-400"
                  }`}
                >
                  Log full amount
                </button>
              </div>
              {amountNum > 0 && (
                <p className="text-[11px] text-slate-500">
                  Your share comes to {formatMoney(perShare, settings)} · logging{" "}
                  <span className="text-emerald-400">{formatMoney(finalAmount, settings)}</span>
                </p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full min-h-[52px] rounded-xl bg-emerald-400 text-slate-950 font-semibold text-sm disabled:opacity-30 disabled:pointer-events-none active:scale-[0.98] transition-all"
        >
          {isEditing ? "Save changes" : "Save transaction"}
        </button>

        {isEditing && (
          <>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-sm font-medium text-rose-300 active:bg-rose-500/[0.16]"
              >
                <Trash2 size={15} />
                Delete transaction
              </button>
            ) : (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 p-3.5">
                <p className="text-xs text-rose-200 mb-3">Delete "{initialTx.title}"? This can't be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 min-h-[44px] rounded-lg bg-white/[0.08] text-sm font-medium text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onDelete(initialTx.id)}
                    className="flex-1 min-h-[44px] rounded-lg bg-rose-500 text-sm font-semibold text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  SETTINGS SHEET
 * ────────────────────────────────────────────────────────────────────── */

function SettingsSheet({ onClose, settings, setSettings, transactions, setTransactions }) {
  const [local, setLocal] = useState(settings);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => setLocal(settings), [settings]);

  const commit = (next) => {
    setLocal(next);
    setSettings(next);
  };

  const [exportError, setExportError] = useState("");

  const handleExport = async () => {
    setExportError("");
    const payload = { settings, transactions, exportedAt: new Date().toISOString() };
    const json = JSON.stringify(payload, null, 2);
    const filename = `worth-it-export-${isoDate(new Date())}.json`;

    if (Capacitor.isNativePlatform()) {
      try {
        const written = await Filesystem.writeFile({
          path: filename,
          data: json,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: "Worth It export",
          text: "Your Worth It backup",
          url: written.uri,
          dialogTitle: "Save your Worth It backup",
        });
      } catch (err) {
        setExportError("Couldn't export — try again, or check storage permissions.");
      }
      return;
    }

    // Browser dev-preview fallback — the download-link trick only works here,
    // not inside the native app's WebView.
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export isn't available in this environment.");
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed.transactions) || typeof parsed.settings !== "object") {
          throw new Error("bad shape");
        }
        setTransactions(parsed.transactions);
        commit(parsed.settings);
      } catch {
        setImportError("Couldn't read that file — make sure it's a Worth It export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleReset = () => {
    setTransactions([]);
    setConfirmReset(false);
    onClose();
  };

  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="space-y-6">
        {/* Ghost mode note */}
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3.5">
          <Ghost size={16} className="text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-200/80 leading-relaxed">
            Ghost Mode is always on. There are no accounts and nothing leaves this device — everything lives in local
            storage only.
          </p>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Your name (optional)</label>
          <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3.5 min-h-[48px]">
            <User size={16} className="text-slate-500 shrink-0" />
            <input
              value={local.userName || ""}
              onChange={(e) => commit({ ...local, userName: e.target.value })}
              placeholder="e.g. Dennis"
              className="bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-600 w-full py-3"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Only used for the greeting at the top — stays on this device like everything else.
          </p>
        </div>

        {/* Currency */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2.5">Currency</h3>
          <div className="relative">
            <select
              value={local.currency}
              onChange={(e) => commit({ ...local, currency: e.target.value })}
              className="w-full appearance-none bg-white/[0.05] border border-white/[0.1] rounded-xl pl-3.5 pr-10 py-3 text-sm text-slate-100 outline-none min-h-[48px] [color-scheme:dark]"
            >
              {CURRENCIES.map((c) => (
                <option key={c.symbol} value={c.symbol}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>
        </div>

        {/* Daily reminder */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2.5">Reminders</h3>
          <div className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-3.5">
            <button
              onClick={() => commit({ ...local, reminderEnabled: !local.reminderEnabled })}
              className="w-full flex items-center justify-between min-h-[44px]"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Bell size={15} className="text-slate-400" />
                Daily reminder
              </span>
              <div
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  local.reminderEnabled ? "bg-emerald-400" : "bg-white/[0.15]"
                }`}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                  style={{ transform: local.reminderEnabled ? "translateX(22px)" : "translateX(2px)" }}
                />
              </div>
            </button>
            <p className="text-[11px] text-slate-500 mt-1.5">
              A daily nudge at the time you choose. Still checks in even after you've logged something — the message just adjusts.
            </p>

            {local.reminderEnabled && (
              <div className="mt-3 pt-3 border-t border-white/[0.08]">
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Remind me at</label>
                <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3.5 min-h-[48px]">
                  <Calendar size={15} className="text-slate-500 shrink-0" />
                  <input
                    type="time"
                    value={local.reminderTime}
                    onChange={(e) => commit({ ...local, reminderTime: e.target.value })}
                    className="bg-transparent outline-none text-sm text-slate-100 w-full py-3 [color-scheme:dark] font-display"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Android will ask permission the first time you turn this on.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Budgets */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2.5">Monthly budgets</h3>
          <div className="space-y-2.5">
            {CATEGORIES.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3">
                <cat.icon size={15} style={{ color: cat.color }} strokeWidth={2.25} className="shrink-0" />
                <span className="text-xs text-slate-400 flex-1">{cat.label}</span>
                <input
                  inputMode="decimal"
                  value={local.budgets[cat.id]}
                  onChange={(e) =>
                    commit({
                      ...local,
                      budgets: { ...local.budgets, [cat.id]: e.target.value.replace(/[^0-9.]/g, "") },
                    })
                  }
                  className="w-28 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-100 outline-none text-right font-display min-h-[44px]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Data */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2.5">Your data</h3>
          <div className="space-y-2">
            <button
              onClick={handleExport}
              className="w-full min-h-[48px] flex items-center gap-3 px-4 rounded-xl bg-white/[0.05] border border-white/[0.1] text-sm font-medium text-slate-200 active:bg-white/[0.09]"
            >
              <Download size={16} className="text-slate-400" />
              Export data (JSON)
              <ChevronRight size={15} className="ml-auto text-slate-600" />
            </button>
            {exportError && (
              <p className="flex items-center gap-1.5 text-xs text-rose-400 px-1">
                <AlertCircle size={13} /> {exportError}
              </p>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full min-h-[48px] flex items-center gap-3 px-4 rounded-xl bg-white/[0.05] border border-white/[0.1] text-sm font-medium text-slate-200 active:bg-white/[0.09]"
            >
              <Upload size={16} className="text-slate-400" />
              Import data (JSON)
              <ChevronRight size={15} className="ml-auto text-slate-600" />
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} className="hidden" />
            {importError && (
              <p className="flex items-center gap-1.5 text-xs text-rose-400 px-1">
                <AlertCircle size={13} /> {importError}
              </p>
            )}

            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="w-full min-h-[48px] flex items-center gap-3 px-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-sm font-medium text-rose-300 active:bg-rose-500/[0.16]"
              >
                <Trash2 size={16} />
                Reset ledger
              </button>
            ) : (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 p-3.5">
                <p className="text-xs text-rose-200 mb-3">
                  This deletes every transaction on this device. This can't be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="flex-1 min-h-[44px] rounded-lg bg-white/[0.08] text-sm font-medium text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex-1 min-h-[44px] rounded-lg bg-rose-500 text-sm font-semibold text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* About */}
        <div className="pt-2 pb-1 text-center">
          <p className="text-xs text-slate-500">
            Worth It · built by DMwenda
          </p>
          <p className="text-[11px] text-slate-600 mt-0.5">© {new Date().getFullYear()} · all rights reserved</p>
          <p className="text-[11px] text-slate-600 mt-0.5">Support the Project +254795422234</p>
        </div>
      </div>
    </Sheet>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  BOTTOM TAB BAR
 * ────────────────────────────────────────────────────────────────────── */

const TABS = [
  { id: "home", label: "Home", icon: Wallet },
  { id: "budgets", label: "Budgets", icon: PieChart },
  { id: "ledger", label: "Ledger", icon: Receipt },
];

function TabBar({ activeTab, setActiveTab }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/[0.08]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-md mx-auto flex items-stretch">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="flex-1 min-h-[56px] flex flex-col items-center justify-center gap-1 active:bg-white/[0.04] transition-colors"
            >
              <t.icon size={20} className={active ? "text-emerald-400" : "text-slate-500"} strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[10px] font-medium ${active ? "text-emerald-400" : "text-slate-500"}`}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 *  APP
 * ────────────────────────────────────────────────────────────────────── */

export default function App() {
  const [transactions, setTransactions] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.transactions);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.settings);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  const [activeFilter, setActiveFilter] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [showAdd, setShowAdd] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    scheduleReminder(settings, transactions);
  }, [settings.reminderEnabled, settings.reminderTime, transactions]);

  const now = new Date();
  const curMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;

  const monthKeyOf = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getFullYear()}-${d.getMonth()}`;
  };

  const curMonthTx = useMemo(() => transactions.filter((t) => monthKeyOf(t.date) === curMonthKey), [transactions, curMonthKey]);
  const prevMonthTx = useMemo(() => transactions.filter((t) => monthKeyOf(t.date) === prevMonthKey), [transactions, prevMonthKey]);

  const categorySpend = useMemo(() => {
    const map = {};
    for (const cat of CATEGORIES) map[cat.id] = 0;
    for (const t of curMonthTx) map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    return map;
  }, [curMonthTx]);

  const prevCategorySpend = useMemo(() => {
    const map = {};
    for (const cat of CATEGORIES) map[cat.id] = 0;
    for (const t of prevMonthTx) map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    return map;
  }, [prevMonthTx]);

  const rollovers = useMemo(() => {
    const map = {};
    const hasPrevHistory = prevMonthTx.length > 0;
    for (const cat of CATEGORIES) {
      const base = Number(settings.budgets[cat.id]) || 0;
      const prevSpent = prevCategorySpend[cat.id] || 0;
      map[cat.id] = hasPrevHistory ? Math.max(0, base - prevSpent) : 0;
    }
    return map;
  }, [settings.budgets, prevCategorySpend, prevMonthTx]);

  const vibeSpend = useMemo(() => {
    const map = {};
    for (const v of VIBES) map[v.id] = 0;
    for (const t of curMonthTx) map[t.vibeId] = (map[t.vibeId] || 0) + t.amount;
    return map;
  }, [curMonthTx]);

  const prevVibeSpend = useMemo(() => {
    const map = {};
    for (const v of VIBES) map[v.id] = 0;
    for (const t of prevMonthTx) map[t.vibeId] = (map[t.vibeId] || 0) + t.amount;
    return map;
  }, [prevMonthTx]);

  const totalSpent = useMemo(() => curMonthTx.reduce((s, t) => s + t.amount, 0), [curMonthTx]);
  const prevTotalSpent = useMemo(() => prevMonthTx.reduce((s, t) => s + t.amount, 0), [prevMonthTx]);
  const totalBudget = useMemo(
    () => CATEGORIES.reduce((s, c) => s + (Number(settings.budgets[c.id]) || 0) + (rollovers[c.id] || 0), 0),
    [settings.budgets, rollovers]
  );

  const daysElapsed = now.getDate();
  const totalDaysInMonth = daysInMonth(now);
  const burnPct = (daysElapsed / totalDaysInMonth) * 100;
  const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions]
  );
  const recentTransactions = useMemo(() => sortedTransactions.slice(0, 3), [sortedTransactions]);

  const filteredTransactions = useMemo(() => {
    let list = sortedTransactions;
    if (activeFilter) {
      list = list.filter((t) =>
        activeFilter.type === "category" ? t.categoryId === activeFilter.id : t.vibeId === activeFilter.id
      );
    }
    return list;
  }, [sortedTransactions, activeFilter]);

  const handleFilter = (f) => {
    setActiveFilter(f);
    if (f) setActiveTab("ledger");
  };

  const handleSaveTx = (tx) => {
    setTransactions((prev) => {
      const exists = prev.some((t) => t.id === tx.id);
      if (exists) return prev.map((t) => (t.id === tx.id ? tx : t));
      return [tx, ...prev];
    });
    setShowAdd(false);
    setEditingTx(null);
  };

  const handleDeleteTx = (id) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setShowAdd(false);
    setEditingTx(null);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 antialiased">
      <GlobalStyles />
      <Header onOpenSettings={() => setShowSettings(true)} userName={settings.userName} />

      <main className="max-w-md mx-auto px-4" style={{ paddingBottom: "calc(9rem + env(safe-area-inset-bottom))" }}>
        {activeTab === "home" && (
          <>
            <HeroSummary
              totalSpent={totalSpent}
              totalBudget={totalBudget}
              burnPct={burnPct}
              budgetPct={budgetPct}
              settings={settings}
            />

            <VibeRecap
              vibeSpend={vibeSpend}
              totalSpent={totalSpent}
              prevVibeSpend={prevVibeSpend}
              prevTotalSpent={prevTotalSpent}
            />

            {recentTransactions.length > 0 && (
              <section className="mt-5 mb-4">
                <div className="flex items-center justify-between mb-2.5 px-0.5">
                  <h2 className="text-sm font-semibold text-slate-300">Recent</h2>
                  <button
                    onClick={() => setActiveTab("ledger")}
                    className="text-xs font-medium text-emerald-400 min-h-[32px] px-1"
                  >
                    View all
                  </button>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] divide-y divide-white/[0.05] overflow-hidden">
                  {recentTransactions.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} settings={settings} onEdit={setEditingTx} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === "budgets" && (
          <>
            <CategoryBudgets
              categorySpend={categorySpend}
              budgets={settings.budgets}
              rollovers={rollovers}
              settings={settings}
              activeFilter={activeFilter}
              onFilter={handleFilter}
            />

            <VibeInsights vibeSpend={vibeSpend} totalSpent={totalSpent} activeFilter={activeFilter} onFilter={handleFilter} />
          </>
        )}

        {activeTab === "ledger" && (
          <>
            <FilterChip filter={activeFilter} onClear={() => setActiveFilter(null)} />
            <TransactionList
              transactions={filteredTransactions}
              settings={settings}
              hasFilter={!!activeFilter}
              onOpenAdd={() => setShowAdd(true)}
              onEditTransaction={setEditingTx}
            />
          </>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        aria-label="Add transaction"
        className="fixed right-4 z-40 w-16 h-16 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center shadow-[0_8px_24px_rgba(52,211,153,0.35)] active:scale-95 transition-transform"
        style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />

      {(showAdd || editingTx) && (
        <QuickAddSheet
          initialTx={editingTx}
          onClose={() => {
            setShowAdd(false);
            setEditingTx(null);
          }}
          onSave={handleSaveTx}
          onDelete={handleDeleteTx}
          settings={settings}
        />
      )}
      {showSettings && (
        <SettingsSheet
          onClose={() => setShowSettings(false)}
          settings={settings}
          setSettings={setSettings}
          transactions={transactions}
          setTransactions={setTransactions}
        />
      )}
    </div>
  );
}