import { useState, type KeyboardEvent } from 'react';

interface HeaderProps {
  onSearch: (city: string) => void;
  onLocate: () => void;
  history: string[];
  onHistorySelect: (city: string) => void;
  locateMessage?: string;
}

export default function Header({
  onSearch, onLocate, history, onHistorySelect, locateMessage,
}: HeaderProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSearch = () => {
    const city = inputValue.trim();
    if (city) onSearch(city);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const city = inputValue.trim();
      if (city) onSearch(city);
    }
  };

  const handleHistoryClick = (city: string) => {
    setInputValue(city);
    onHistorySelect(city);
  };

  return (
    <header>
      <h1><span className="emoji">☁️</span> 天气预报</h1>
      <div className="search-box">
        <input
          type="text"
          placeholder="输入城市名称（如：北京、Shanghai）"
          autoComplete="off"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button onClick={handleSearch}>搜索</button>
        <button id="locationBtn" onClick={onLocate}>
          📍 定位
        </button>
      </div>
      {locateMessage && <p className="weather-locate-msg" role="status">{locateMessage}</p>}
      <div className="search-history">
        {history.map((city) => (
          <button
            type="button"
            key={city}
            className="history-chip"
            onClick={() => handleHistoryClick(city)}
          >
            {city}
          </button>
        ))}
      </div>
    </header>
  );
}
