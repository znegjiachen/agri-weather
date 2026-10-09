export default function UnitToggle({ isCelsius, onChange }) {
  return (
    <div className="top-bar">
      <div className="unit-toggle">
        <button
          className={isCelsius ? 'active' : ''}
          onClick={() => onChange(true)}
        >
          °C
        </button>
        <button
          className={!isCelsius ? 'active' : ''}
          onClick={() => onChange(false)}
        >
          °F
        </button>
      </div>
    </div>
  );
}
