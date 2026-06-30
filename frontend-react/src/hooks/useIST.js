import { useState, useEffect, useRef } from 'react';

const istFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hour12: false,
});

function getISTParts() {
  const parts = istFormatter.formatToParts(new Date());
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
  return { hours: get('hour'), minutes: get('minute'), seconds: get('second') };
}

export function useIST() {
  const [time, setTime] = useState(getISTParts);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTime(getISTParts());
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const { hours, minutes, seconds } = time;

  const h12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formatted = `${h12}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${ampm}`;

  return {
    time,
    hours,
    minutes,
    seconds,
    formatted,
  };
}
