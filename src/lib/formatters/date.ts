const padTime = (value: number) => String(value).padStart(2, "0");

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatIsoDate = (value: string | null | undefined, fallback = "--") => {
  const parsed = parseDate(value);
  if (!parsed) return fallback;

  const year = parsed.getFullYear();
  const month = padTime(parsed.getMonth() + 1);
  const day = padTime(parsed.getDate());
  return `${year}-${month}-${day}`;
};

export const formatIsoDateTime = (value: string | null | undefined, fallback = "--") => {
  const parsed = parseDate(value);
  if (!parsed) return fallback;

  const date = formatIsoDate(value, fallback);
  if (date === fallback) return fallback;

  const hour = padTime(parsed.getHours());
  const minute = padTime(parsed.getMinutes());
  const second = padTime(parsed.getSeconds());
  return `${date} ${hour}:${minute}:${second}`;
};
