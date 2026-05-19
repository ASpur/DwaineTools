const NumberInput = ({ label, name, value, onChange }) => (
  <div className="flex flex-col">
    <label className="text-lg font-bold text-term-text mb-1 uppercase tracking-wider">{label}</label>
    <input
      type="number"
      name={name}
      value={value}
      onChange={onChange}
      className="bg-term-bg border border-term-border text-term-text px-3 py-2 focus:outline-none focus:border-term-text transition-all text-xl placeholder-term-text/50"
    />
  </div>
);

export default NumberInput;
