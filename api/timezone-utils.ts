export function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(
        (part): part is Intl.DateTimeFormatPart & {
          type: "year" | "month" | "day" | "hour" | "minute" | "second";
        } =>
          part.type === "year" ||
          part.type === "month" ||
          part.type === "day" ||
          part.type === "hour" ||
          part.type === "minute" ||
          part.type === "second",
      )
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

export function getDateKeyInTimeZone(date: Date, timeZone: string) {
  const { year, month, day } = getTimeZoneParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 0, day: day ?? 0 };
}

export function compareDateKeys(left: string, right: string) {
  return left.localeCompare(right);
}

export function listDateKeysInclusive(startKey: string, endKey: string) {
  const keys: string[] = [];
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const endDate = new Date(Date.UTC(end.year, end.month - 1, end.day));

  while (cursor.getTime() <= endDate.getTime()) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const day = cursor.getUTCDate();
    keys.push(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
}

export function createEndOfDayInTimeZone(dateKey: string, timeZone: string) {
  const { year, month, day } = parseDateKey(dateKey);
  const utcGuess = Date.UTC(year, month - 1, day, 23, 59, 59);
  const observed = getTimeZoneParts(new Date(utcGuess), timeZone);
  const offsetMs =
    Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    ) - utcGuess;

  return new Date(utcGuess - offsetMs);
}
