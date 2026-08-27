const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayString = (now = new Date()): string => toLocalDateString(now);

export const parseLocalDate = (value: string): Date => {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (match === null) {
    throw new Error(`Invalid local date: ${value}`);
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12);
  if (toLocalDateString(parsed) !== value) {
    throw new Error(`Invalid local date: ${value}`);
  }

  return parsed;
};

export const addLocalDays = (value: string, days: number): string => {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + Math.trunc(days));
  return toLocalDateString(date);
};

export const getRecentDateStrings = (days: number, today = getTodayString()): string[] => {
  const safeDays = Math.max(1, Math.floor(days));
  return Array.from({ length: safeDays }, (_, index) => addLocalDays(today, index - safeDays + 1));
};

export const getLocalDateRange = (value: string, now = new Date()): { end: Date; start: Date } => {
  const calendarDate = parseLocalDate(value);
  const start = new Date(calendarDate);
  start.setHours(0, 0, 0, 0);
  const nextDay = new Date(start);
  nextDay.setDate(nextDay.getDate() + 1);

  return {
    end: value === getTodayString(now) ? now : nextDay,
    start,
  };
};
