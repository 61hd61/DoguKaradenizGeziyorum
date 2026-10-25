type Listener = (payload: { revision: string; reason?: string }) => void;

const listeners = new Set<Listener>();

export function subscribeRevision(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishRevision(revision: string, reason?: string) {
  const payload = { revision, reason };
  for (const fn of listeners) fn(payload);
}
