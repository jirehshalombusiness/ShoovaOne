import { useEffect, useRef, useCallback } from 'react';

interface UseIdleOptions {
  idleMs?: number;         // default 15 min
  signOutMs?: number;      // default 30 min
  onIdle?: () => void;
  onReturn?: () => void;
  onSignOut?: () => void;
}

export function useIdleDetection({
  idleMs = 15 * 60 * 1000,
  signOutMs = 30 * 60 * 1000,
  onIdle,
  onReturn,
  onSignOut,
}: UseIdleOptions) {
  const lastActivityRef = useRef(Date.now());
  const isIdleRef = useRef(false);
  const isSignedOutRef = useRef(false);

  // Store callbacks in refs so the interval closure sees fresh versions
  const onIdleRef = useRef(onIdle);
  const onReturnRef = useRef(onReturn);
  const onSignOutRef = useRef(onSignOut);

  useEffect(() => { onIdleRef.current = onIdle; }, [onIdle]);
  useEffect(() => { onReturnRef.current = onReturn; }, [onReturn]);
  useEffect(() => { onSignOutRef.current = onSignOut; }, [onSignOut]);

  const updateActivity = useCallback(() => {
    if (isSignedOutRef.current) return;
    lastActivityRef.current = Date.now();

    if (isIdleRef.current) {
      isIdleRef.current = false;
      onReturnRef.current?.();
    }
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'visibilitychange'];
    events.forEach((e) => window.addEventListener(e, updateActivity));

    const interval = setInterval(() => {
      if (isSignedOutRef.current) return;
      const idle = Date.now() - lastActivityRef.current;

      if (idle >= signOutMs && !isSignedOutRef.current) {
        isSignedOutRef.current = true;
        isIdleRef.current = true;
        onSignOutRef.current?.();
      } else if (idle >= idleMs && !isIdleRef.current) {
        isIdleRef.current = true;
        onIdleRef.current?.();
      }
    }, 30_000); // check every 30s

    return () => {
      events.forEach((e) => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [idleMs, signOutMs, updateActivity]);
}