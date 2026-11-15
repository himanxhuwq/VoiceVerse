// Toast notifications: call toast('message') from anywhere.
import { useSyncExternalStore } from 'react';

let current = null; // { id, text }
let timer = 0;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function toast(text) {
  current = { id: Date.now(), text };
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    emit();
  }, 2200);
}

export function useToast() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}
