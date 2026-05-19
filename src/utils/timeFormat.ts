export const formatNullableTime = (timestamp: string | null, fallback = 'Not yet'): string => {
  if (timestamp === null) {
    return fallback;
  }

  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
};
