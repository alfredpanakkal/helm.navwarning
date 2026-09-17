export const LAST_UPDATED = ((import.meta as any).env?.VITE_APP_BUILD_TIME as string) || new Date().toISOString();

/**
 * Formats an ISO string date into Indian Standard Time (Asia/Kolkata):
 * e.g., "Last updated: 17 Sep 2026, 10:06 IST"
 */
export function formatLastUpdated(dateInput: string = LAST_UPDATED): string {
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      return `Last updated: ${dateInput}`;
    }

    const formatter = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    });

    const parts = formatter.formatToParts(date);
    let day = '', month = '', year = '', hour = '', minute = '';
    for (const part of parts) {
      if (part.type === 'day') day = part.value;
      if (part.type === 'month') month = part.value;
      if (part.type === 'year') year = part.value;
      if (part.type === 'hour') hour = part.value;
      if (part.type === 'minute') minute = part.value;
    }

    return `Last updated: ${day} ${month} ${year}, ${hour}:${minute} IST`;
  } catch (err) {
    return `Last updated: ${dateInput}`;
  }
}
