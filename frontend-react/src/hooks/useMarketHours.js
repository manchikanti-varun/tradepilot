import { useState, useEffect } from 'react';
import { useIST } from './useIST';
import { useMarketStore } from '../store/useMarketStore';

export function useMarketHours() {
  const { hours, minutes } = useIST();
  const [briefDismissed, setBriefDismissed] = useState(false);

  // Backend-reported status (accounts for holidays, weekends, actual market state)
  const backendStatus = useMarketStore((s) => s.marketStatus);

  const totalMinutes = hours * 60 + minutes;
  const marketOpen = 9 * 60 + 15;  // 9:15
  const marketClose = 15 * 60 + 30; // 15:30
  const preMarketStart = 9 * 60;    // 9:00

  // Client-side time checks (fallback if backend hasn't responded yet)
  const clientIsPreMarket = totalMinutes >= preMarketStart && totalMinutes < marketOpen;
  const clientIsMarketOpen = totalMinutes >= marketOpen && totalMinutes <= marketClose;
  const clientIsPostMarket = totalMinutes > marketClose;

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  // Use backend status as the source of truth (handles holidays)
  // Fall back to client-side time check only if backend hasn't responded
  let isMarketOpen, isPreMarket, isPostMarket;

  if (backendStatus && backendStatus !== 'CLOSED') {
    // Backend says market is open or pre-market
    isMarketOpen = backendStatus === 'OPEN';
    isPreMarket = backendStatus === 'PRE_MARKET';
    isPostMarket = false;
  } else if (backendStatus === 'CLOSED') {
    // Backend explicitly says closed (holiday, weekend, or post-market)
    isMarketOpen = false;
    isPreMarket = false;
    isPostMarket = clientIsPostMarket && !isWeekend;
  } else {
    // Backend hasn't responded yet — use client-side (but respect weekends)
    isMarketOpen = !isWeekend && clientIsMarketOpen;
    isPreMarket = !isWeekend && clientIsPreMarket;
    isPostMarket = !isWeekend && clientIsPostMarket;
  }

  const status = isMarketOpen ? 'OPEN' : isPreMarket ? 'PRE_MARKET' : 'CLOSED';

  // Minutes until open
  const minutesUntilOpen = isMarketOpen ? 0 : totalMinutes < marketOpen ? marketOpen - totalMinutes : (24 * 60 - totalMinutes) + marketOpen;

  // Minutes until close
  const minutesUntilClose = isMarketOpen ? marketClose - totalMinutes : 0;

  // Brief modal trigger
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
