export const ORGANIZATION_TYPES = [
  { value: 'police', label: 'Поліція' },
  { value: 'medical', label: 'Медична' },
  { value: 'transport', label: 'Транспорт' },
  { value: 'religious', label: 'Релігійна' },
  { value: 'shelter', label: 'Прихистки' },
] as const;

export function getOrganizationTypeLabel(type: string): string {
  const found = ORGANIZATION_TYPES.find(t => t.value === type);
  return found ? found.label : type;
}
