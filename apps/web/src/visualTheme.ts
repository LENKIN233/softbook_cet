import {STUDIO} from '../../mobile/src/visual/studio';

export const studioVariables: Record<string, string> = {
  '--page': STUDIO.color.page,
  '--page-deep': STUDIO.color.pageDeep,
  '--surface': STUDIO.color.paper,
  '--surface-soft': STUDIO.color.paperSoft,
  '--ink': STUDIO.color.ink,
  '--ink-2': STUDIO.color.inkSecondary,
  '--muted': STUDIO.color.muted,
  '--line': STUDIO.color.line,
  '--brand': STUDIO.color.brand,
  '--brand-deep': STUDIO.color.brandDeep,
  '--brand-soft': STUDIO.color.brandSoft,
  '--success': STUDIO.color.success,
  '--danger': STUDIO.color.danger,
  '--studio-card-radius': STUDIO.radius.card + 'px',
  '--studio-control-radius': STUDIO.radius.control + 'px',
  '--icon-stroke': String(STUDIO.icon.stroke),
  '--motion-press': STUDIO.motion.press + 'ms',
  '--motion-select': STUDIO.motion.selection + 'ms',
  '--motion-reveal': STUDIO.motion.reveal + 'ms',
  '--motion-enter': STUDIO.motion.enter + 'ms',
  '--motion-route': STUDIO.motion.route + 'ms',
  '--motion-wave': STUDIO.motion.wave + 'ms',
  '--motion-easing': STUDIO.motion.easing,
};

export function installStudioTheme() {
  for (const [name, value] of Object.entries(studioVariables)) {
    document.documentElement.style.setProperty(name, value);
  }
}
