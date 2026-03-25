import type { AttendanceSettings } from '@/types/hr';

/** Used when API has no settings row yet (before first save). */
export const defaultAttendanceSettings: AttendanceSettings = {
  ipRestrictionEnabled: false,
  allowedIPs: ['192.168.1.0/24'],
  autoMarkAbsent: true,
  halfDayThresholdHours: 4,
  fullDayThresholdHours: 8,
};
