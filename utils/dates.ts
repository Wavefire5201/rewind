export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function formatDateLabel(date: string): string {
  // "MARCH 9, 2026" format
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
}

export function getDayNumber(joinDate: string, currentDate?: string): number {
  const join = new Date(joinDate + 'T00:00:00');
  const current = currentDate ? new Date(currentDate + 'T00:00:00') : new Date();
  const diff = Math.floor((current.getTime() - join.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1; // Day 1 on join date
}

export function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getWeekDays(referenceDate?: string): Array<{ date: string; dayLabel: string; dayNumber: number }> {
  const ref = referenceDate ? new Date(referenceDate + 'T12:00:00') : new Date();
  const dayOfWeek = ref.getDay(); // 0=Sun
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - ((dayOfWeek + 6) % 7)); // get Monday

  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const days: Array<{ date: string; dayLabel: string; dayNumber: number }> = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ date: dateStr, dayLabel: labels[i], dayNumber: d.getDate() });
  }
  return days;
}

export function getCalendarMonth(year: number, month: number): Array<Array<string | null>> {
  // month is 1-based (1=Jan)
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startDow = firstDay.getDay(); // 0=Sun

  const weeks: Array<Array<string | null>> = [];
  let currentWeek: Array<string | null> = [];

  // Pad start
  for (let i = 0; i < startDow; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    currentWeek.push(dateStr);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Pad end
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

export function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toLowerCase();
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

