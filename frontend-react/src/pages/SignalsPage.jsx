import SignalFeed from '../components/signals/SignalFeed';
import MarketPulse from '../components/market/MarketPulse';
import ToastContainer from '../components/shared/Toast';

export default function SignalsPage() {
  return (
    <div>
      <MarketPulse />
      <SignalFeed />
      <ToastContainer />
    </div>
  );
}
