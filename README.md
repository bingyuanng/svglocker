# SVGLOCKER

CLI that optimizes SVG icons with SVGO and packs them into a single SVG sprite.

## Usage

```
svglocker <input_path> <output_path> [options]
```

| Option | Description |
|--------|-------------|
| `--watch` | Rebuild when SVG files change |
| `--map <file>` | Write an icon name map (`.js`, `.mjs`, `.cjs`, or `.ts`) |
| `--prefix <string>` | Prefix for symbol ids |
| `--no-recursive` | Only include SVGs in the top-level input directory |

Nested files become dashed ids (`nav/close.svg` → `nav-close`). Duplicate ids fail the build.

```
npm run build-example
```

Then serve `example/build/` over HTTP (or localhost). External SVG `<use href="sprites.svg#id">` references often do not load from `file://`.

## SVGO config

Resolved in this order:

1. SVGO's native config in the cwd (`svgo.config.mjs` / `.js` / `.cjs`)
2. Legacy `svgo-config.json` in the cwd
3. Built-in defaults (`preset-default` + remove fill/stroke)

## Programmatic API

```js
import { buildSprite } from "svglocker";

const { sprite, icons } = await buildSprite({
  input: "icons",
  prefix: "icon-"
});
```
