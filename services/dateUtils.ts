
export const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getNowISOString = (): string => {
  return new Date().toISOString();
};

export const parseDateString = (dateStr: string): Date => {
  // Parses YYYY-MM-DD as local date
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const HOLIDAYS_2026 = [
  '2026-01-01', // Año Nuevo
  '2026-01-06', // Reyes
  '2026-03-19', // San José
  '2026-04-02', // Jueves Santo
  '2026-04-03', // Viernes Santo
  '2026-04-16', // Santa Faz (Alicante)
  '2026-05-01', // Fiesta del Trabajo
  '2026-06-23', // Hogueras (Alicante)
  '2026-06-24', // San Juan
  '2026-08-15', // Asunción
  '2026-10-12', // Fiesta Nacional
  '2026-11-01', // Todos los Santos
  '2026-12-06', // Constitución
  '2026-12-08', // Inmaculada
  '2026-12-25', // Navidad
];

export const isHoliday = (date: Date | string): boolean => {
  const dateStr = typeof date === 'string' ? date : getLocalDateString(date);
  return HOLIDAYS_2026.includes(dateStr);
};

export const isWeekend = (date: Date | string): boolean => {
  const d = typeof date === 'string' ? parseDateString(date) : date;
  const day = d.getDay();
  return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
};

export const isWorkDay = (date: Date | string): boolean => {
  return !isHoliday(date) && !isWeekend(date);
};
