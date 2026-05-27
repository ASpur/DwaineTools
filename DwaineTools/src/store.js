import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  // Persisted settings (synced with localStorage manually in App.jsx or via effects)
  theme: localStorage.getItem('dwaine_theme') || 'thinktronic',
  fontMode: localStorage.getItem('dwaine_font_mode') || 'terminal',
  isCrtEnabled: localStorage.getItem('dwaine_crt_filter') !== 'false',
  activeTool: localStorage.getItem('dwaine_active_tool') || 'teleporter',
  
  // Unlocks
  isSyndicateUnlocked: localStorage.getItem('dwaine_login_packet_setup_unlocked') === 'true',
  isRainbowUnlocked: localStorage.getItem('dwaine_rainbow_unlocked') === 'true' || localStorage.getItem('dwaine_theme') === 'rainbow',

  // UI State
  appTitle: 'DWAINE TOOLS',
  isDrawerOpen: false,
  isRingMessageOpen: false,
  
  // Glitch & Theme Transitions
  isThemeSwitching: false,
  themeSwitchDuration: 240,
  isGlitching: false,
  glitchMessage: '',
  glitchKey: 0,
  teleporterUnlockSignal: 0,

  // Actions
  setTheme: (theme) => set({ theme }),
  setFontMode: (fontMode) => set({ fontMode }),
  setIsCrtEnabled: (isCrtEnabled) => set({ isCrtEnabled }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setAppTitle: (appTitle) => set({ appTitle }),
  setIsDrawerOpen: (isDrawerOpen) => set({ isDrawerOpen }),
  setIsRingMessageOpen: (isRingMessageOpen) => set({ isRingMessageOpen }),
  
  unlockSyndicate: () => set({ isSyndicateUnlocked: true }),
  unlockRainbow: () => set({ isRainbowUnlocked: true }),
  
  triggerTeleporterUnlockSignal: () => set((state) => ({ teleporterUnlockSignal: state.teleporterUnlockSignal + 1 })),

  // Complex Actions
  switchTheme: (nextTheme, options = {}) => {
    const state = get();
    if (nextTheme === state.theme) return;
    
    const transitionMs = options.transitionMs ?? 240;
    const settleMs = options.settleMs ?? 260;

    set({ isThemeSwitching: true, themeSwitchDuration: transitionMs, theme: nextTheme });
    
    window.setTimeout(() => {
      set({ isThemeSwitching: false, themeSwitchDuration: 240 });
    }, settleMs);
  },

  triggerGlitch: (message = '') => {
    set((state) => ({
      isDrawerOpen: false,
      isGlitching: false,
      glitchMessage: message,
      glitchKey: state.glitchKey + 1
    }));

    window.requestAnimationFrame(() => {
      set({ isGlitching: true });
      window.setTimeout(() => {
        set({ isGlitching: false, glitchMessage: '' });
      }, 1120); // glitchDuration
    });
  }
}));
