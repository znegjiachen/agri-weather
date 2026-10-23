import Dashboard from './Dashboard';
import FeatureGrid from '../components/FeatureGrid';
import HomeWeather from '../components/HomeWeather';

export default function HomePage() {
  return (
    <div className="home-page">
      <HomeWeather />
      <Dashboard />
      <FeatureGrid />
    </div>
  );
}
