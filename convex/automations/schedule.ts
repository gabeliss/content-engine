/**
 * Scheduling utilities for automations
 * Handles timezone-aware scheduling calculations
 */

export interface PostingTime {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  minute: number; // 0-59
}

export interface ScheduleConfig {
  timezone: string;
  postingTimes: PostingTime[];
}

/**
 * Calculate the next posting time from a schedule configuration
 * @param scheduleConfig The schedule configuration
 * @param fromTimestamp The timestamp to calculate from (usually Date.now())
 * @returns The next posting time as a UTC timestamp
 */
export function getNextPostingTime(
  scheduleConfig: ScheduleConfig,
  fromTimestamp: number
): number {
  const { timezone, postingTimes } = scheduleConfig;

  if (postingTimes.length === 0) {
    throw new Error("No posting times configured");
  }

  // Get current time components in target timezone
  const fromDate = new Date(fromTimestamp);
  const { dayOfWeek, hour, minute, year, month, day } = getTimeInTimezone(
    fromDate,
    timezone
  );

  // Find the next posting time
  let bestCandidate: { daysAhead: number; time: PostingTime } | null = null;

  for (const time of postingTimes) {
    let daysAhead = time.dayOfWeek - dayOfWeek;
    if (daysAhead < 0) daysAhead += 7;

    // If same day, check if the time has already passed
    if (daysAhead === 0) {
      const scheduledMinutes = time.hour * 60 + time.minute;
      const currentMinutes = hour * 60 + minute;
      if (scheduledMinutes <= currentMinutes) {
        daysAhead = 7; // Next week
      }
    }

    if (!bestCandidate || daysAhead < bestCandidate.daysAhead) {
      bestCandidate = { daysAhead, time };
    }
  }

  if (!bestCandidate) {
    throw new Error("Could not calculate next run time");
  }

  // Calculate target date
  const targetDay = day + bestCandidate.daysAhead;
  const targetDateStr = formatDateString(
    year,
    month,
    targetDay,
    bestCandidate.time.hour,
    bestCandidate.time.minute
  );

  return convertToUtc(targetDateStr, timezone);
}

/**
 * Calculate the next N posting times
 * @param scheduleConfig The schedule configuration
 * @param count Number of posting times to calculate
 * @param fromTimestamp The timestamp to start from
 * @returns Array of UTC timestamps
 */
export function getNextNPostingTimes(
  scheduleConfig: ScheduleConfig,
  count: number,
  fromTimestamp: number
): number[] {
  const times: number[] = [];
  let currentFrom = fromTimestamp;

  for (let i = 0; i < count; i++) {
    const nextTime = getNextPostingTime(scheduleConfig, currentFrom);
    times.push(nextTime);
    // Add 1 minute to ensure we get the next slot
    currentFrom = nextTime + 60 * 1000;
  }

  return times;
}

/**
 * Format a schedule for display
 * @param scheduleConfig The schedule configuration
 * @returns Human-readable schedule description
 */
export function formatScheduleDescription(
  scheduleConfig: ScheduleConfig
): string {
  const { postingTimes, timezone } = scheduleConfig;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (postingTimes.length === 0) {
    return "No schedule configured";
  }

  // Group times by day
  const byDay = new Map<number, PostingTime[]>();
  for (const time of postingTimes) {
    const existing = byDay.get(time.dayOfWeek) || [];
    existing.push(time);
    byDay.set(time.dayOfWeek, existing);
  }

  // Format each day
  const parts: string[] = [];
  for (const [dayOfWeek, times] of byDay) {
    const dayName = dayNames[dayOfWeek];
    const timeStrings = times
      .map((t) => formatTime(t.hour, t.minute))
      .join(", ");
    parts.push(`${dayName} at ${timeStrings}`);
  }

  return `${parts.join("; ")} (${timezone})`;
}

/**
 * Validate a schedule configuration
 * @param scheduleConfig The schedule configuration to validate
 * @returns Object with isValid and optional error message
 */
export function validateScheduleConfig(scheduleConfig: ScheduleConfig): {
  isValid: boolean;
  error?: string;
} {
  const { timezone, postingTimes } = scheduleConfig;

  // Validate timezone
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    return { isValid: false, error: `Invalid timezone: ${timezone}` };
  }

  // Validate posting times
  if (postingTimes.length === 0) {
    return { isValid: false, error: "At least one posting time is required" };
  }

  for (const time of postingTimes) {
    if (time.dayOfWeek < 0 || time.dayOfWeek > 6) {
      return {
        isValid: false,
        error: `Invalid day of week: ${time.dayOfWeek}`,
      };
    }
    if (time.hour < 0 || time.hour > 23) {
      return { isValid: false, error: `Invalid hour: ${time.hour}` };
    }
    if (time.minute < 0 || time.minute > 59) {
      return { isValid: false, error: `Invalid minute: ${time.minute}` };
    }
  }

  // Check for duplicates
  const seen = new Set<string>();
  for (const time of postingTimes) {
    const key = `${time.dayOfWeek}-${time.hour}-${time.minute}`;
    if (seen.has(key)) {
      return { isValid: false, error: "Duplicate posting time found" };
    }
    seen.add(key);
  }

  return { isValid: true };
}

// Helper functions

function getTimeInTimezone(
  date: Date,
  timezone: string
): {
  dayOfWeek: number;
  hour: number;
  minute: number;
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    dayOfWeek: dayNames.indexOf(getPart("weekday")),
    hour: parseInt(getPart("hour"), 10),
    minute: parseInt(getPart("minute"), 10),
    year: parseInt(getPart("year"), 10),
    month: parseInt(getPart("month"), 10),
    day: parseInt(getPart("day"), 10),
  };
}

function formatDateString(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function convertToUtc(localDateStr: string, timezone: string): number {
  // Parse the local date string
  const [datePart, timePart] = localDateStr.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  // Create a date in UTC first
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  // Get the offset between UTC and the target timezone at this time
  const tzFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Find the UTC time that corresponds to the local time
  // We do this by adjusting until the timezone representation matches
  let testTime = utcDate.getTime();
  const targetStr = `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}, ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  // Binary search for the correct UTC time (within 24 hours)
  let low = testTime - 24 * 60 * 60 * 1000;
  let high = testTime + 24 * 60 * 60 * 1000;

  while (high - low > 60000) {
    // Within 1 minute accuracy
    const mid = Math.floor((low + high) / 2);
    const midDate = new Date(mid);
    const midStr = tzFormatter.format(midDate);

    if (midStr === targetStr) {
      return mid;
    }

    // Compare lexicographically (not perfect but works for our format)
    if (midStr < targetStr) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.floor((low + high) / 2);
}

/**
 * Get posting times for the next week for display
 */
export function getUpcomingPostsForWeek(
  scheduleConfig: ScheduleConfig,
  fromTimestamp: number = Date.now()
): Array<{ timestamp: number; dayOfWeek: number; hour: number; minute: number }> {
  const oneWeekLater = fromTimestamp + 7 * 24 * 60 * 60 * 1000;
  const posts: Array<{
    timestamp: number;
    dayOfWeek: number;
    hour: number;
    minute: number;
  }> = [];

  let currentFrom = fromTimestamp;
  while (currentFrom < oneWeekLater) {
    try {
      const nextTime = getNextPostingTime(scheduleConfig, currentFrom);
      if (nextTime >= oneWeekLater) break;

      const { dayOfWeek, hour, minute } = getTimeInTimezone(
        new Date(nextTime),
        scheduleConfig.timezone
      );
      posts.push({ timestamp: nextTime, dayOfWeek, hour, minute });
      currentFrom = nextTime + 60 * 1000; // Move 1 minute ahead
    } catch {
      break;
    }
  }

  return posts;
}
