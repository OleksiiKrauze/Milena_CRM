/**
 * Format date for Ukrainian locale
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/Kiev',
  });
}

/**
 * Format date and time for Ukrainian locale
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kiev',
  });
}

/**
 * Format phone number in Ukrainian format
 * +380XXXXXXXXX -> +380 XX XXX XX XX
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('380') && cleaned.length === 12) {
    return `+380 ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10)}`;
  }
  return phone;
}

/**
 * Extract original filename from uploaded file URL
 * /uploads/uuid_originalname.ext -> originalname.ext
 */
export function getOriginalFilename(url: string): string {
  const filename = url.split('/').pop() || '';
  // Format: uuid_originalname.ext
  const parts = filename.split('_');
  if (parts.length > 1) {
    // Return everything after first underscore (original name + extension)
    return parts.slice(1).join('_');
  }
  return filename;
}

/**
 * Convert UTC datetime string to local datetime string for datetime-local input
 * Server returns: "2024-01-11T10:00:00Z" (UTC)
 * Input needs: "2024-01-11T12:00" (Kyiv time, without Z)
 */
export function utcToLocalDateTimeInput(utcDateString: string): string {
  if (!utcDateString) return '';

  const date = new Date(utcDateString);

  // Convert to Kyiv timezone and format for datetime-local input
  const kyivTime = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Kiev',
  }).formatToParts(date);

  const parts: Record<string, string> = {};
  kyivTime.forEach(({ type, value }) => {
    parts[type] = value;
  });

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * Convert local datetime from datetime-local input to UTC datetime string
 * Input provides: "2024-01-11T12:00" (user's local time in Kyiv)
 * Server needs: "2024-01-11T10:00:00Z" (UTC)
 */
export function localDateTimeInputToUtc(localDateString: string): string {
  if (!localDateString) return '';

  // Parse as Kyiv timezone
  const [datePart, timePart] = localDateString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  // Convert to UTC by creating Date object and getting ISO string
  const kyivOffset = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kiev', timeZoneName: 'shortOffset' }).split('GMT')[1];
  const offsetHours = parseInt(kyivOffset) || 2; // Default to +2 if can't parse

  const utcDate = new Date(year, month - 1, day, hour - offsetHours, minute);
  return utcDate.toISOString();
}
