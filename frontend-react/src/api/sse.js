import { useMarketStore } from '../store/useMarketStore';
import { usePositionStore } from '../store/usePositionStore';
import { useAppStore } from '../store/useAppStore';
import { marketApi } from './market';
import { signalsApi } from './signals';
import { positionApi } from './position';

const BASE = import.meta.env.VITE_API_URL || '';
const RETRY_DELAYS = [3000, 10000, 30000];

let eventSource = null;
let retryCount = 0;
let fallbackIntervals = [];
let sseAvailable = false;

export function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  try {
    const token = localStorage.getItem('tp_access_token');
    const url = `${BASE}/api/stream${token ? `?token=${token}` : ''}`;
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      retryCount = 0;
      sseAvailable = true;
      useAppStore.getState().setConnectionStatus('connected');
      refreshAllStores();
    };

    eventSource.addEventListener('signal_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        useMarketStore.getState().setSignals(data.signals || []);
      } catch { /* malformed event */ }
    });

    eventSource.addEventListener('position_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        usePositionStore.getState().updateFromApi(data);
      } catch { /* malformed event */ }
    });

    eventSource.addEventListener('risk_gate_change', (e) => {
      try {
        const data = JSON.parse(e.data);
        useMarketStore.getState().setRiskGate(data.risk_gate, data.risk_reason);
        useAppStore.getState().addNotification({
          type: data.risk_gate === 'HARD_STOP' ? 'risk' : 'warning',
          title: `Risk: ${data.risk_gate}`,
          detail: data.risk_reason,
        });
      } catch { /* malformed event */ }
    });

    eventSource.addEventListener('exit_signal', (e) => {
      try {
        const data = JSON.parse(e.data);
        usePositionStore.getState().setExitSignal(data);
        useAppStore.getState().addNotification({
          type: 'exit',
          title: `EXIT — ${data.urgency}`,
          detail: data.reason,
        });
      } catch { /* malformed event */ }
    });

    eventSource.addEventListener('scan_complete', () => {
      useMarketStore.getState().resetScanCountdown();
      signalsApi.current().then(data => {
        useMarketStore.getState().setSignals(data.signals || []);
      }).catch(() => {});
    });

    eventSource.onerror = () => {
      eventSource.close();
      eventSource = null;
      handleDisconnect();
    };
  } catch {
    sseAvailable = false;
    startFallbackPolling();
  }
}

function handleDisconnect() {
  useAppStore.getState().setConnectionStatus('reconnecting');

  if (retryCount < RETRY_DELAYS.length) {
    const delay = RETRY_DELAYS[retryCount];
    retryCount++;
    setTimeout(() => connectSSE(), delay);
  } else {
    useAppStore.getState().setConnectionStatus('disconnected');
    startFallbackPolling();
  }
}

function startFallbackPolling() {
  stopFallbackPolling();

  // Critical data: 5s polling
  const criticalInterval = setInterval(async () => {
    try {
      const [pos, sig] = await Promise.all([
        positionApi.current(),
        signalsApi.current(),
      ]);
      usePositionStore.getState().updateFromApi(pos);
      useMarketStore.getState().setSignals(sig.signals || []);
      useAppStore.getState().setConnectionStatus('polling');
    } catch {
      useAppStore.getState().setConnectionStatus('disconnected');
    }
  }, 5000);

  // Market data: 10s polling
  const marketInterval = setInterval(async () => {
    try {
      const state = await marketApi.state();
      useMarketStore.getState().updateFromState(state);
    } catch { /* will retry next cycle */ }
  }, 10000);

  fallbackIntervals = [criticalInterval, marketInterval];
}

function stopFallbackPolling() {
  fallbackIntervals.forEach(clearInterval);
  fallbackIntervals = [];
}

async function refreshAllStores() {
  try {
    const [state, pos, sig, countdown] = await Promise.all([
      marketApi.state(),
      positionApi.current(),
      signalsApi.current(),
      marketApi.countdown(),
    ]);
    useMarketStore.getState().updateFromState(state);
    // Ensure marketStatus is updated immediately so SignalFeed renders the correct branch
    if (countdown?.status) {
      useMarketStore.getState().setMarketStatus(countdown.status);
    }
    usePositionStore.getState().updateFromApi(pos);
    useMarketStore.getState().setSignals(sig.signals || []);
  } catch { /* initial load failure handled by components */ }
}

export function disconnectSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  stopFallbackPolling();
}

export function isSSEConnected() {
  return sseAvailable && eventSource?.readyState === EventSource.OPEN;
}
