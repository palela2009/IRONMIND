import { useEffect, RefObject } from 'react';

type Scrollable = {
  scrollTo?: (opts: { y: number; animated: boolean }) => void;
  scrollToOffset?: (opts: { offset: number; animated: boolean }) => void;
};

const listeners = new Set<(tab: string) => void>();

export const notifyTabChange = (tab: string) => listeners.forEach((l) => l(tab));

export const useTabScrollReset = (tab: string, ref: RefObject<Scrollable | null>) => {
  useEffect(() => {
    const listener = (next: string) => {
      if (next !== tab) return;
      const list = ref.current;
      if (list?.scrollToOffset) list.scrollToOffset({ offset: 0, animated: false });
      else list?.scrollTo?.({ y: 0, animated: false });
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [tab, ref]);
};
