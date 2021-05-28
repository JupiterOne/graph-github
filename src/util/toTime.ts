export default function toTime(
  time: Date | string | undefined
): number | undefined {
  return time ? new Date(time).getTime() : undefined;
}
