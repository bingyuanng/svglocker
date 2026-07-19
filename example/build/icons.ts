export const icons = {
  "icon-minus": "icon-minus",
  "icon-nav-close": "icon-nav-close",
  "icon-plus": "icon-plus"
} as const;

export type IconName = keyof typeof icons;
