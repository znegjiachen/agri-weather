import Dashboard from './Dashboard';
import FeatureGrid from '../components/FeatureGrid';
import MobileHome from './MobileHome';
import { useMediaQuery } from '../hooks/useMediaQuery';

export default function HomePage() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return <MobileHome />;
  }

  return (
    <div className="home-page">
      <Dashboard />
      <FeatureGrid />
    </div>
  );
}