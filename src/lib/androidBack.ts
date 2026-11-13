import { useEffect, useRef } from 'react';

export type AndroidBackResult = 'handled' | 'busy' | 'home';
declare global {
  interface Window { __hansearchHandleBack?: () => AndroidBackResult; }
}

/** The native shell evaluates this function; no privileged JS interface is exposed. */
export function useAndroidBack(handler: () => AndroidBackResult) {
  const current = useRef(handler);
  current.current = handler;
  useEffect(() => {
    const callback = () => current.current();
    window.__hansearchHandleBack = callback;
    return () => {
      if (window.__hansearchHandleBack === callback) delete window.__hansearchHandleBack;
    };
  }, []);
}
