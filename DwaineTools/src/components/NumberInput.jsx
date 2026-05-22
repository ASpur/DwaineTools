const NumberInput = ({ label, name, value, onChange, help }) => {
  const stepValue = (direction) => {
    const currentValue = value === '' ? 0 : Number(value);
    const nextValue = Number.isFinite(currentValue) ? currentValue + direction : direction;

    onChange({
      target: {
        name,
        value: String(nextValue),
        type: 'number',
      },
    });
  };

  return (
    <div className="flex flex-col">
      <label className="text-lg font-bold text-term-text mb-1 uppercase tracking-wider">
        <span className={help ? 'field-help' : undefined}>
          {label}
          {help && (
            <span className="field-help-popup" role="tooltip">
              {help}
            </span>
          )}
        </span>
      </label>
      <div className="flex border border-term-border bg-term-bg focus-within:border-term-text transition-colors">
        <input
          type="number"
          name={name}
          value={value}
          onChange={onChange}
          className="number-input flex-1 min-w-0 bg-transparent text-term-text px-3 py-2 focus:outline-none text-xl placeholder-term-text/50"
        />
        <div className="flex border-l border-term-border">
          <button
            type="button"
            onClick={() => stepValue(-1)}
            className="w-9 text-xl font-bold text-term-text hover:bg-term-hover hover:text-term-hover-text border-r border-term-border transition-colors"
            aria-label={`Decrease ${label}`}
          >
            -
          </button>
          <button
            type="button"
            onClick={() => stepValue(1)}
            className="w-9 text-xl font-bold text-term-text hover:bg-term-hover hover:text-term-hover-text transition-colors"
            aria-label={`Increase ${label}`}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

export default NumberInput;
