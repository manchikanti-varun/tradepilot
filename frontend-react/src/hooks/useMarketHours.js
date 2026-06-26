import { useState, useEffect, useRef } from 'react';
import { useIST } from './useIST';

export function useMarketHours() {
  const { hours, minutes } = useIST();
  const [briefDismissed, setBriefDismissed] = useState(false);

  const totalMinutes = hours * 60 + minutes;
  const marketOpen = 9 * 60 + 15;  // 9:15
  const marketClose = 15 * 60 + 30; // 15:30
  const preMarketStart = 9 * 60;    // 9:00

  const isPreMarket = totalMinutes >= preMarketStart && totalMinutes < marketOpen;
  const isMarketOpen = totalMinutes >= marketOpen && totalMinutes <= marketClose;
  const isPostMarket = totalMinutes > marketClose;

  // Check if it's weekend
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  const status = isWeekend ? 'CLOSED' : isMarketOpen ? 'OPEN' : isPreMarket ? 'PRE_MARKET' : 'CLOSED';

  // Minutes until open
  const minutesUntilOpen = isMarketOpen ? 0 : totalMinutes < marketOpen ? marketOpen - totalMinutes : (24 * 60 - totalMinutes) + marketOpen;

  // Minutes until close
  const minutesUntilClose = isMarketOpen ? marketClose - totalMinutes : 0;

  // Brief modal trigger — show at 9:00 if not dismissed
  useEffect(() => {
    const today = now.toISOString().slice(0, 10);
    const key = `brief_read_${today}`;
    if (localStorage.getItem(key)) {
      setBriefDismissed(true);
    }
  }, []);

  const shouldShowBrief = isPreMarket && !briefDismissed && !isWeekend;

  const dismissBrief = () => {
    const today = now.toISOString().slice(0, 10);
    localStorage.setItem(`brief_read_${today}`, 'true');
    setBriefDismissed(true);
  };

  return {
    isPreMarket,
    isMarketOpen,
    isPostMarket,
    isWeekend,
    status,
    minutesUntilOpen,
    minutesUntilClose,
    shouldShowBrief,
    dismissBrief,
  };
}
