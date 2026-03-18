export function normalizeRoomInput(input: string | null | undefined): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const fromQuery = url.searchParams.get('room');
    if (fromQuery?.trim()) return fromQuery.trim();
  } catch {
    // not a full URL
  }

  if (raw.startsWith('?')) {
    const qs = new URLSearchParams(raw);
    const fromQuery = qs.get('room');
    if (fromQuery?.trim()) return fromQuery.trim();
  }

  const roomEq = raw.match(/(?:^|[?&])room=([^&]+)/i);
  if (roomEq?.[1]) {
    try {
      return decodeURIComponent(roomEq[1]).trim();
    } catch {
      return roomEq[1].trim();
    }
  }

  return raw;
}

