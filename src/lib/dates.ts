const DISPLAY_DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

const DISPLAY_DATETIME: Intl.DateTimeFormatOptions = {
  ...DISPLAY_DATE,
  hour: "numeric",
  minute: "2-digit",
};

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

/** e.g. 01 Apr 2026 */
export function formatDisplayDate(value: string | Date) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", DISPLAY_DATE);
}

/** e.g. 01 Apr */
export function formatDisplayDateNoYear(value: string | Date) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/** e.g. 01 Apr 2026, 3:30 pm */
export function formatDisplayDateTime(value: string | Date) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", DISPLAY_DATETIME);
}

/** e.g. 01 Apr, 3:30 pm — for compact tables */
export function formatDisplayDateTimeNoYear(value: string | Date) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** For HTML date inputs (YYYY-MM-DD). */
export function toInputDateValue(iso: string) {
  return iso.slice(0, 10);
}
