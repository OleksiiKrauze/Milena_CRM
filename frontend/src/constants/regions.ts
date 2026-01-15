/**
 * Ukrainian regions (oblasts) for dropdown selection
 * Priority regions first (bold in UI), then alphabetical
 */

export const PRIORITY_REGIONS = [
  'Харківська',
  'Дніпропетровська',
  'Запорізька',
  'Херсонська',
  'Донецька',
  'Полтавська',
  'Київська',
] as const;

export const OTHER_REGIONS = [
  'Вінницька',
  'Волинська',
  'Житомирська',
  'Закарпатська',
  'Івано-Франківська',
  'Кіровоградська',
  'Луганська',
  'Львівська',
  'Миколаївська',
  'Одеська',
  'Рівненська',
  'Сумська',
  'Тернопільська',
  'Хмельницька',
  'Черкаська',
  'Чернівецька',
  'Чернігівська',
] as const;

export const ALL_REGIONS = [...PRIORITY_REGIONS, ...OTHER_REGIONS] as const;
