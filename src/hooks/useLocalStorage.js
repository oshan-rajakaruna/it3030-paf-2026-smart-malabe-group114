import { useEffect, useState } from 'react';

function resolveInitialValue(initialValue) {
  return initialValue instanceof Function ? initialValue() : initialValue;
}

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') {
      return resolveInitialValue(initialValue);
    }

    try {
      const storedValue = window.localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : resolveInitialValue(initialValue);
    } catch (error) {
      return resolveInitialValue(initialValue);
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Ignore storage failures in restrictive environments.
    }
  }, [key, value]);

  return [value, setValue];
}
