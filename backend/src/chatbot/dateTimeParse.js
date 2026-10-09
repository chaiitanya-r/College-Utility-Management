export const HALL_TIME_SLOTS = [
  "09:00-11:00",
  "11:00-13:00",
  "13:00-15:00",
  "15:00-17:00",
  "17:00-19:00"
];

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function formatDateOnly(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function extractDateHints(text, referenceDate = new Date()) {
  const hints = new Set();
  const lower = String(text || "").toLowerCase();
  const ref = startOfDay(referenceDate);

  if (/\btoday\b/.test(lower)) hints.add(formatDateOnly(ref));
  if (/\btomorrow\b/.test(lower)) hints.add(formatDateOnly(addDays(ref, 1)));
  if (/\bday after tomorrow\b/.test(lower)) hints.add(formatDateOnly(addDays(ref, 2)));

  const nextDayMatch = lower.match(
    /\b(?:this\s+)?(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/
  );
  if (nextDayMatch) {
    const target = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday"
    ].indexOf(nextDayMatch[1]);
    if (target >= 0) {
      const d = new Date(ref);
      const current = d.getDay();
      let delta = (target - current + 7) % 7;
      if (delta === 0 && /\bnext\b/.test(nextDayMatch[0])) delta = 7;
      if (delta === 0 && !/\bthis\b/.test(nextDayMatch[0])) delta = 7;
      hints.add(formatDateOnly(addDays(ref, delta)));
    }
  }

  for (const m of String(text || "").matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)) {
    if (DATE_ONLY_REGEX.test(m[1])) hints.add(m[1]);
  }

  for (const m of String(text || "").matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g)) {
    const [, dd, mm, yyyy] = m;
    const iso = `${yyyy}-${pad2(Number(mm))}-${pad2(Number(dd))}`;
    if (DATE_ONLY_REGEX.test(iso)) hints.add(iso);
  }

  for (const m of String(text || "").matchAll(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/gi
  )) {
    const months = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11
    };
    const key = m[2].slice(0, 3).toLowerCase();
    const month = months[key];
    if (month != null) {
      const year = m[3] ? Number(m[3]) : ref.getFullYear();
      const d = new Date(year, month, Number(m[1]));
      if (!Number.isNaN(d.getTime())) hints.add(formatDateOnly(d));
    }
  }

  return [...hints];
}

export function normalizeHallTimeSlot(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const exact = HALL_TIME_SLOTS.find((s) => s === raw);
  if (exact) return exact;

  const compact = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?$/i);
  if (compact) {
    const start = `${pad2(Number(compact[1]))}:${pad2(compact[2] ? Number(compact[2]) : 0)}`;
    const end = `${pad2(Number(compact[3]))}:${pad2(compact[4] ? Number(compact[4]) : 0)}`;
    const candidate = `${start}-${end}`;
    return HALL_TIME_SLOTS.find((s) => s === candidate) || candidate;
  }

  const lower = raw.toLowerCase();
  if (/\bmorning\b/.test(lower)) return "09:00-11:00";
  if (/\b(early\s+)?afternoon\b/.test(lower) && !/\blate\b/.test(lower)) return "13:00-15:00";
  if (/\blate\s+afternoon\b/.test(lower)) return "15:00-17:00";
  if (/\bevening\b/.test(lower)) return "17:00-19:00";

  return null;
}

export function extractTimeSlotHints(text) {
  const hints = new Set();
  const normalized = normalizeHallTimeSlot(text);
  if (normalized) hints.add(normalized);

  for (const slot of HALL_TIME_SLOTS) {
    if (text.includes(slot)) hints.add(slot);
  }

  return [...hints];
}

export function enrichUserMessageForModel(content, referenceDate = new Date()) {
  const dates = extractDateHints(content, referenceDate);
  const slots = extractTimeSlotHints(content);
  if (dates.length === 0 && slots.length === 0) return content;

  const parts = [];
  if (dates.length) parts.push(`parsed dates: ${dates.join(", ")}`);
  if (slots.length) parts.push(`parsed hall slots: ${slots.join(", ")}`);
  return `${content}\n\n[Assistant hint — use these in tool calls if relevant: ${parts.join("; ")}.]`;
}
