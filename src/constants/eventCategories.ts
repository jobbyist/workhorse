export const VEHICLE_BRANDS = [
  { value: 'toyota', label: 'Toyota', emoji: '🚗' },
  { value: 'volkswagen', label: 'Volkswagen', emoji: '🚙' },
  { value: 'mazda', label: 'Mazda', emoji: '🏎️' },
  { value: 'hyundai', label: 'Hyundai', emoji: '🚘' },
  { value: 'bmw', label: 'BMW', emoji: '🔵' },
  { value: 'mercedes', label: 'Mercedes', emoji: '⭐' },
  { value: 'ford', label: 'Ford', emoji: '🔷' },
  { value: 'nissan', label: 'Nissan', emoji: '🔴' },
  { value: 'honda', label: 'Honda', emoji: '🔘' },
  { value: 'audi', label: 'Audi', emoji: '💫' },
  { value: 'kia', label: 'Kia', emoji: '🟢' },
  { value: 'other', label: 'Other', emoji: '🚐' },
] as const;

export type VehicleBrand = typeof VEHICLE_BRANDS[number]['value'];

// Keep legacy exports for backwards compatibility during migration
export const EVENT_CATEGORIES = VEHICLE_BRANDS;
export type EventCategory = VehicleBrand;
