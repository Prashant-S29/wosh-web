import { formatInTimeZone } from 'date-fns-tz';

export const formatDate = (dateString: string): string => {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Parse the date as if it's from the source timezone
  const date = new Date(dateString);

  // If development, we need to treat the UTC timestamp as IST
  // if (process.env.NODE_ENV === 'development') {
  //   return formatInTimeZone(dateString.replace('Z', ''), 'Asia/Kolkata', 'MMMM dd, yyyy • hh:mm a');
  // }

  // For production, display UTC time in user's timezone
  return formatInTimeZone(date, userTimezone, 'MMMM dd, yyyy • hh:mm a');
};
