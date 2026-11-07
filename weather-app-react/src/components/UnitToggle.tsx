interface UnitToggleProps {
  isCelsius: boolean;
  onChange: (isCelsius: boolean) => void;
}

export default function UnitToggle({ isCelsius, onChange }: UnitToggleProps) {
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
