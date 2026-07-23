import moment from "moment-timezone";

export type ResolvedLocalTime = {
  utcDate: Date;
  offsetMinutes: number;
  offsetHours: number;
  abbreviation: string;
  timezoneId: string;
  timezoneDataVersion: string;
};

export type ResolvedLocalDay = {
  startUtc: Date;
  endUtc: Date;
  timezoneId: string;
  timezoneDataVersion: string;
};

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseLocalParts(date: string, time: string): LocalParts {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dateMatch || !timeMatch) throw new Error("Enter a valid local birth date and time.");

  const parts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] ?? 0),
  };

  const check = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  );
  if (
    check.getUTCFullYear() !== parts.year ||
    check.getUTCMonth() !== parts.month - 1 ||
    check.getUTCDate() !== parts.day ||
    parts.hour > 23 ||
    parts.minute > 59 ||
    parts.second > 59
  ) {
    throw new Error("Enter a valid local birth date and time.");
  }
  return parts;
}

function sameLocalParts(instant: number, timezoneId: string, expected: LocalParts) {
  const local = moment.tz(instant, timezoneId);
  return (
    local.year() === expected.year &&
    local.month() === expected.month - 1 &&
    local.date() === expected.day &&
    local.hour() === expected.hour &&
    local.minute() === expected.minute &&
    local.second() === expected.second
  );
}

function possibleInstants(parts: LocalParts, timezoneId: string) {
  const zone = moment.tz.zone(timezoneId);
  if (!zone) throw new Error("The selected IANA timezone is not supported.");

  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const offsets = Array.from(new Set(zone.offsets));
  const candidates = offsets
    .map((minutesWest) => localAsUtc + minutesWest * 60_000)
    .filter((instant) => zone.utcOffset(instant) === (instant - localAsUtc) / 60_000)
    .filter((instant) => sameLocalParts(instant, timezoneId, parts));

  return Array.from(new Set(candidates)).sort((left, right) => left - right);
}

export function resolveLocalTime(date: string, time: string, timezoneId: string): ResolvedLocalTime {
  const parts = parseLocalParts(date, time);
  const candidates = possibleInstants(parts, timezoneId);
  if (candidates.length === 0) {
    throw new Error(
      "That local time did not exist because the clock moved forward. Enter the recorded time carefully.",
    );
  }
  if (candidates.length > 1) {
    throw new Error(
      "That local time occurred twice because the clock moved backward. Choose a different recorded time or confirm the UTC offset with an expert.",
    );
  }

  const local = moment.tz(candidates[0], timezoneId);
  return {
    utcDate: new Date(candidates[0]),
    offsetMinutes: local.utcOffset(),
    offsetHours: local.utcOffset() / 60,
    abbreviation: local.zoneAbbr(),
    timezoneId,
    timezoneDataVersion: moment.tz.dataVersion,
  };
}

function addCivilDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function resolveLocalDay(date: string, timezoneId: string): ResolvedLocalDay {
  const startCandidates = possibleInstants(parseLocalParts(date, "00:00:00"), timezoneId);
  const nextDate = addCivilDays(date, 1);
  const nextCandidates = possibleInstants(parseLocalParts(nextDate, "00:00:00"), timezoneId);
  if (startCandidates.length === 0 || nextCandidates.length === 0) {
    throw new Error("This civil date cannot be resolved safely in the selected timezone.");
  }

  const start = Math.min(...startCandidates);
  const nextStart = Math.min(...nextCandidates);
  if (nextStart <= start) throw new Error("This civil date has an invalid timezone range.");

  return {
    startUtc: new Date(start),
    endUtc: new Date(nextStart - 1),
    timezoneId,
    timezoneDataVersion: moment.tz.dataVersion,
  };
}

export function localPartsAtInstant(instant: Date, timezoneId: string) {
  const local = moment.tz(instant, timezoneId);
  return {
    date: local.format("YYYY-MM-DD"),
    time: local.format("HH:mm:ss"),
    offsetHours: local.utcOffset() / 60,
  };
}
