import fs from "fs";
import path from "path";
import { load as loadHtml } from "cheerio";
import { optimize, loadConfig } from "svgo";

const NAMESPACE = "http://www.w3.org/2000/svg";
const XLINK = "http://www.w3.org/1999/xlink";
const FORMAT = ".svg";

export const DEFAULT_SVGO_CONFIG = {
  multipass: true,
  plugins: [
    "preset-default",
    {
      name: "removeAttrs",
      params: { attrs: "(fill|stroke)" }
    }
  ]
};

/**
 * @typedef {{ file: string, id: string }} IconEntry
 * @typedef {{
 *   input: string,
 *   prefix?: string,
 *   recursive?: boolean,
 *   svgoConfig?: object,
 * }} BuildOptions
 * @typedef {{ sprite: string, icons: IconEntry[] }} BuildResult
 */

/**
 * @param {BuildOptions} options
 * @returns {Promise<BuildResult>}
 */
export async function buildSprite(options) {
  const input = path.resolve(options.input);
  const prefix = options.prefix ?? "";
  const recursive = options.recursive !== false;

  if (!fs.existsSync(input) || !fs.statSync(input).isDirectory()) {
    throw new Error(`Input path is not a directory: ${input}`);
  }

  const files = getFiles(input, recursive);
  if (files.length === 0) {
    throw new Error(`No ${FORMAT} files found in ${input}`);
  }

  const icons = createIconEntries(files, prefix);
  const svgoConfig = options.svgoConfig ?? (await resolveSvgoConfig());
  const sprite = createSpriteXml(input, icons, svgoConfig);

  return { sprite, icons };
}

/**
 * @param {string} [cwd]
 */
export async function resolveSvgoConfig(cwd = process.cwd()) {
  const explicitJson = path.join(cwd, "svgo-config.json");
  const discovered = await loadConfig(undefined, cwd);
  if (discovered) {
    return discovered;
  }
  if (fs.existsSync(explicitJson)) {
    return JSON.parse(fs.readFileSync(explicitJson, "utf8"));
  }
  return DEFAULT_SVGO_CONFIG;
}

/**
 * @param {string} inputPath
 * @param {boolean} recursive
 */
export function getFiles(inputPath, recursive) {
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) {
          walk(absolute);
        }
        continue;
      }
      if (entry.isFile() && path.extname(entry.name).toLowerCase() === FORMAT) {
        files.push(path.relative(inputPath, absolute));
      }
    }
  }

  walk(inputPath);
  return files.sort((a, b) => a.localeCompare(b));
}

/**
 * @param {string[]} files
 * @param {string} prefix
 * @returns {IconEntry[]}
 */
export function createIconEntries(files, prefix) {
  const seen = new Map();
  const icons = [];

  for (const file of files) {
    const id = toSymbolId(file, prefix);
    if (seen.has(id)) {
      throw new Error(
        `Duplicate symbol id "${id}" from ${seen.get(id)} and ${file}`
      );
    }
    seen.set(id, file);
    icons.push({ file, id });
  }

  return icons;
}

/**
 * @param {string} relativePath
 * @param {string} prefix
 */
export function toSymbolId(relativePath, prefix) {
  const withoutExt = relativePath
    .replace(/\\/g, "/")
    .replace(/\.svg$/i, "");
  const id = withoutExt.split("/").filter(Boolean).join("-");
  return `${prefix}${id}`;
}

/**
 * @param {IconEntry[]} icons
 * @param {"js" | "mjs" | "cjs" | "ts"} format
 */
export function formatIconMapModule(icons, format) {
  const entries = icons
    .map(({ id }) => `  ${formatMapKey(id)}: ${JSON.stringify(id)}`)
    .join(",\n");

  if (format === "ts") {
    return `export const icons = {\n${entries}\n} as const;\n\nexport type IconName = keyof typeof icons;\n`;
  }
  if (format === "cjs") {
    return `module.exports.icons = {\n${entries}\n};\n`;
  }
  return `export const icons = {\n${entries}\n};\n\nexport default icons;\n`;
}

/**
 * @param {IconEntry[]} icons
 */
export function iconsToRecord(icons) {
  /** @type {Record<string, string>} */
  const record = {};
  for (const icon of icons) {
    record[icon.id] = icon.id;
  }
  return record;
}

function formatMapKey(id) {
  return /^[A-Za-z_$][\w$]*$/.test(id) ? id : JSON.stringify(id);
}

function getViewBox($svg) {
  const viewBox = $svg.attr("viewBox");
  if (viewBox) {
    return viewBox;
  }

  const width = parseFloat($svg.attr("width"));
  const height = parseFloat($svg.attr("height"));
  if (!Number.isNaN(width) && !Number.isNaN(height)) {
    return `0 0 ${width} ${height}`;
  }

  return undefined;
}

function createSymbol(inputPath, icon, svgoConfig) {
  const filePath = path.join(inputPath, icon.file);
  const source = fs.readFileSync(filePath, "utf8");
  const { data } = optimize(source, { ...svgoConfig, path: filePath });
  const $svg = loadHtml(data, {
    xml: { xmlMode: true }
  })("svg");

  const $symbol = loadHtml("<symbol></symbol>", {
    xml: { xmlMode: true }
  })("symbol");
  const viewBox = getViewBox($svg);
  if (viewBox) {
    $symbol.attr("viewBox", viewBox);
  }
  $symbol.attr("id", icon.id);
  $symbol.html($svg.html());
  return $symbol.first();
}

function createSpriteXml(inputPath, icons, svgoConfig) {
  const $sprites = loadHtml("<svg></svg>", { xml: { xmlMode: true } });
  const $svg = $sprites("svg");
  $svg.attr("xmlns", NAMESPACE);
  $svg.attr("xmlns:xlink", XLINK);
  $svg.append("<style>svg * { all: inherit }</style>");

  for (const icon of icons) {
    $svg.append(createSymbol(inputPath, icon, svgoConfig));
  }

  return $sprites.xml();
}
