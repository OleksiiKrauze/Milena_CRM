/**
 * Ukrainian regions (oblasts) for dropdown selection
 * Priority regions are listed first, followed by all others in alphabetical order
 */

export interface Region {
  value: string;
  label: string;
  isPriority?: boolean;
}

// Priority regions (shown first with ★ marker)
const PRIORITY_REGIONS: Region[] = [
  { value: 'Харківська', label: '★ Харківська', isPriority: true },
  { value: 'Дніпропетровська', label: '★ Дніпропетровська', isPriority: true },
  { value: 'Запорізька', label: '★ Запорізька', isPriority: true },
  { value: 'Херсонська', label: '★ Херсонська', isPriority: true },
  { value: 'Київська', label: '★ Київська', isPriority: true },
];

// All other regions in alphabetical order
const OTHER_REGIONS: Region[] = [
  { value: 'Вінницька', label: 'Вінницька' },
  { value: 'Волинська', label: 'Волинська' },
  { value: 'Донецька', label: 'Донецька' },
  { value: 'Житомирська', label: 'Житомирська' },
  { value: 'Закарпатська', label: 'Закарпатська' },
  { value: 'Івано-Франківська', label: 'Івано-Франківська' },
  { value: 'Кіровоградська', label: 'Кіровоградська' },
  { value: 'Луганська', label: 'Луганська' },
  { value: 'Львівська', label: 'Львівська' },
  { value: 'Миколаївська', label: 'Миколаївська' },
  { value: 'Одеська', label: 'Одеська' },
  { value: 'Полтавська', label: 'Полтавська' },
  { value: 'Рівненська', label: 'Рівненська' },
  { value: 'Сумська', label: 'Сумська' },
  { value: 'Тернопільська', label: 'Тернопільська' },
  { value: 'Хмельницька', label: 'Хмельницька' },
  { value: 'Черкаська', label: 'Черкаська' },
  { value: 'Чернівецька', label: 'Чернівецька' },
  { value: 'Чернігівська', label: 'Чернігівська' },
  { value: 'АР Крим', label: 'АР Крим' },
];

// Combined list with priority regions first
export const UKRAINIAN_REGIONS: Region[] = [...PRIORITY_REGIONS, ...OTHER_REGIONS];

// Helper to check if a region is priority
export const isPriorityRegion = (regionValue: string): boolean => {
  return PRIORITY_REGIONS.some(r => r.value === regionValue);
};
