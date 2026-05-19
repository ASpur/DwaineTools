import readmeText from '../../../README.md?raw';

const AboutTool = () => (
  <div className="p-4 md:p-8 selection:bg-term-hover selection:text-term-hover-text">
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-4 border-b-2 border-term-border pb-4">
        <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-4 uppercase tracking-wider">
          <span className="text-term-text opacity-90">{'>_'}</span>
          About
        </h2>
      </div>

      <div className="border-2 border-term-border bg-term-bg p-4 md:p-6">
        <pre className="text-xl text-term-text whitespace-pre-wrap leading-relaxed">
          {readmeText}
        </pre>
      </div>
    </div>
  </div>
);

export default AboutTool;
