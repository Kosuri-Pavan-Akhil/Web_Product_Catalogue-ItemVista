import { useEffect, useState } from 'react';

type RequestState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown };

export function useApiData<T>(load: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const [state, setState] = useState<RequestState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    load(controller.signal).then(
      data => {
        if (!controller.signal.aborted) setState({ status: 'success', data });
      },
      error => {
        if (!controller.signal.aborted) setState({ status: 'error', error });
      },
    );
    return () => controller.abort();
  }, [load, enabled, attempt]);

  function retry() {
    setState({ status: 'loading' });
    setAttempt(previous => previous + 1);
  }

  return { state, retry };
}
