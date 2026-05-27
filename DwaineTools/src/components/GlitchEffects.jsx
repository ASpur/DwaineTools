import { useAppStore } from '../store';

const glitchDuration = 1120;

export default function GlitchEffects() {
  const { isCrtEnabled, isGlitching, glitchKey, glitchMessage } = useAppStore();

  return (
    <>
      {isGlitching && (
        <svg key={`crt-glitch-filter-${glitchKey}`} className="crt-glitch-svg-filter" aria-hidden="true" focusable="false">
          <filter id="crt-glitch-warp" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.12" numOctaves="1" seed={(glitchKey % 97) + 1} result="noise">
              <animate attributeName="baseFrequency" dur={`${glitchDuration}ms`} values="0.012 0.08;0.034 0.16;0.018 0.11;0.042 0.2;0.01 0.07" repeatCount="1" fill="freeze" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G">
              <animate attributeName="scale" dur={`${glitchDuration}ms`} values="0;5;2;8;3;0" repeatCount="1" fill="freeze" />
            </feDisplacementMap>
          </filter>
        </svg>
      )}

      {isCrtEnabled && <div className="crt-filter" aria-hidden="true" />}
      {isGlitching && <div key={glitchKey} className="screen-glitch" aria-hidden="true" />}
      {isGlitching && glitchMessage && (
        <div key={`glitch-warning-${glitchKey}`} className="screen-glitch-warning" aria-hidden="true">
          {glitchMessage}
        </div>
      )}
    </>
  );
}
