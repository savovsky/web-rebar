// Shared Radix DropdownMenu class strings for the top-bar menus (File, Edit).
// One place to change (doc 10): design tokens only, no literal styles (rule 6).
export const MENU_TRIGGER_CLASS =
  'rounded-sm px-panel py-0.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ' +
  'data-[state=open]:bg-accent data-[state=open]:text-foreground';
export const MENU_CONTENT_CLASS = 'z-50 min-w-44 rounded-md border border-border bg-panel p-1 shadow-md';
export const MENU_ITEM_CLASS =
  'flex cursor-default select-none items-center justify-between gap-panel rounded-sm px-panel py-1 ' +
  'text-xs text-foreground outline-none data-[highlighted]:bg-accent ' +
  'data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground';
export const MENU_SHORTCUT_CLASS = 'ml-4 font-mono text-muted-foreground';
export const MENU_SEPARATOR_CLASS = 'my-1 h-px bg-border';
