import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { load } from "cheerio";
import {
  buildSprite,
  createIconEntries,
  formatIconMapModule,
  getFiles,
  iconsToRecord,
  toSymbolId
} from "../lib/core.js";

function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "svglocker-test-"));
  const input = path.join(root, "icons");
  fs.mkdirSync(path.join(input, "nav"), { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, input };
}

test("symbol ids normalize nested and Windows paths", () => {
  assert.equal(toSymbolId("nav/close.svg", "icon-"), "icon-nav-close");
  assert.equal(toSymbolId("nav\\close.SVG", ""), "nav-close");
});

test("icon entries reject colliding symbol ids", () => {
  assert.throws(
    () => createIconEntries(["foo-bar.svg", "foo/bar.svg"], ""),
    /Duplicate symbol id "foo-bar" from foo-bar\.svg and foo\/bar\.svg/
  );
});

test("file discovery is sorted, recursive, and SVG-only", t => {
  const { input } = createFixture(t);
  fs.writeFileSync(path.join(input, "z.svg"), "<svg/>");
  fs.writeFileSync(path.join(input, "a.SVG"), "<svg/>");
  fs.writeFileSync(path.join(input, "notes.txt"), "ignored");
  fs.writeFileSync(path.join(input, "nav", "close.svg"), "<svg/>");

  assert.deepEqual(getFiles(input, true), ["a.SVG", "nav/close.svg", "z.svg"]);
  assert.deepEqual(getFiles(input, false), ["a.SVG", "z.svg"]);
});

test("icon maps support module formats and safe property names", () => {
  const icons = [
    { file: "add.svg", id: "add" },
    { file: "nav/close.svg", id: "nav-close" }
  ];

  assert.match(formatIconMapModule(icons, "ts"), /add: "add"/);
  assert.match(formatIconMapModule(icons, "ts"), /"nav-close": "nav-close"/);
  assert.match(formatIconMapModule(icons, "ts"), /export type IconName/);
  assert.match(formatIconMapModule(icons, "cjs"), /^module\.exports\.icons/);
  assert.match(formatIconMapModule(icons, "js"), /export default icons/);
  assert.deepEqual(iconsToRecord(icons), {
    add: "add",
    "nav-close": "nav-close"
  });
});

test("buildSprite creates ordered symbols and derives missing viewBox values", async t => {
  const { input } = createFixture(t);
  fs.writeFileSync(
    path.join(input, "add.svg"),
    '<svg width="24" height="12"><path fill="red" d="M0 0h1v1z"/></svg>'
  );
  fs.writeFileSync(
    path.join(input, "nav", "close.svg"),
    '<svg viewBox="0 0 16 16"><path stroke="blue" d="M0 0h1"/></svg>'
  );

  const { sprite, icons } = await buildSprite({
    input,
    prefix: "icon-",
    svgoConfig: { plugins: [] }
  });
  const $ = load(sprite, { xml: { xmlMode: true } });
  const symbols = $("symbol").toArray();

  assert.deepEqual(icons, [
    { file: "add.svg", id: "icon-add" },
    { file: "nav/close.svg", id: "icon-nav-close" }
  ]);
  assert.equal($("svg").first().attr("xmlns"), "http://www.w3.org/2000/svg");
  assert.deepEqual(
    symbols.map(symbol => $(symbol).attr("id")),
    ["icon-add", "icon-nav-close"]
  );
  assert.equal($(symbols[0]).attr("viewBox"), "0 0 24 12");
  assert.equal($(symbols[1]).attr("viewBox"), "0 0 16 16");
  assert.equal($(symbols[0]).find("path").attr("fill"), "red");
});

test("buildSprite reports invalid and empty input directories", async t => {
  const { root, input } = createFixture(t);

  await assert.rejects(
    buildSprite({ input: path.join(root, "missing") }),
    /Input path is not a directory/
  );
  await assert.rejects(buildSprite({ input }), /No \.svg files found/);
});
