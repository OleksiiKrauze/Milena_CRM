/**
 * Format date for Ukrainian locale
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
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
