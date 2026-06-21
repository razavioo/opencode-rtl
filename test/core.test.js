import assert from "node:assert/strict"
import test from "node:test"
import {
  analyzeDirection,
  detectLanguage,
  formatRtlText,
  normalizeOptions,
  stripDirectionalControls,
  systemPrompt,
} from "../dist/core.js"

test("detects Arabic as RTL", () => {
  const text = "\u0645\u0631\u062d\u0628\u0627 opencode"
  const analysis = analyzeDirection(text, normalizeOptions({}))
  assert.equal(analysis.direction, "rtl")
  assert.equal(analysis.language, "ar")
})

test("treats mixed Persian and English as RTL at twenty percent threshold", () => {
  const text = "\u0627\u06cc\u0646 \u0645\u062a\u0646 \u0641\u0627\u0631\u0633\u06cc \u0628\u0627 opencode config path"
  const analysis = analyzeDirection(text, normalizeOptions({ minRtlRatio: 0.2 }))
  assert.equal(analysis.direction, "rtl")
  assert.ok(analysis.rtlRatio >= 0.2)
})

test("detects Hebrew before generic RTL", () => {
  assert.equal(detectLanguage("\u05e9\u05dc\u05d5\u05dd"), "he")
})

test("preserves neutral text", () => {
  const analysis = analyzeDirection("12345", normalizeOptions({}))
  assert.equal(analysis.direction, "neutral")
})

test("isolates RTL prose without changing code fences", () => {
  const options = normalizeOptions({ isolateAssistantText: "auto" })
  const input = ["\u0633\u0644\u0627\u0645", "```", "const x = 1", "```"].join("\n")
  const output = formatRtlText(input, "auto", options)
  assert.match(output, /^\u2067/)
  assert.match(output, /```\nconst x = 1\n```$/)
})

test("hard-wraps and right-aligns RTL paragraphs", () => {
  const options = normalizeOptions({ alignRtlParagraphs: true, rtlWrapColumn: 12, rtlAlignColumn: 16 })
  const input = "\u0627\u06cc\u0646 \u06cc\u06a9 \u067e\u0627\u0631\u0627\u06af\u0631\u0627\u0641 \u0637\u0648\u0644\u0627\u0646\u06cc \u0627\u0633\u062a"
  const output = formatRtlText(input, "auto", options)
  const lines = output.split("\n")

  assert.ok(lines.length > 1)
  assert.ok(lines.every((line) => line.includes("\u00a0") && line.includes("\u2067") && line.endsWith("\u2069")))
})

test("wraps RTL markdown blocks in right-aligned containers when requested", () => {
  const options = normalizeOptions({ wrapRtlMarkdown: "auto" })
  const output = formatRtlText("\u0627\u06cc\u0646 \u0645\u062a\u0646 opencode\n\nThis is English.\n\n```js\nconsole.log('hi')\n```", "auto", options)

  assert.match(output, /<div dir="rtl" align="right">/)
  assert.match(output, /<\/div>/)
  assert.match(output, /\u2067/)
  assert.match(output, /This is English\./)
  assert.match(output, /```js\nconsole\.log\('hi'\)\n```/)
})

test("preserves markdown structures while formatting RTL blocks", () => {
  const options = normalizeOptions({ wrapRtlMarkdown: "auto", minRtlRatio: 0.2 })
  const input = [
    "# \u0639\u0646\u0648\u0627\u0646 \u0641\u0627\u0631\u0633\u06cc",
    "",
    "\u0627\u06cc\u0646 \u06cc\u06a9 \u067e\u0627\u0631\u0627\u06af\u0631\u0627\u0641 \u0641\u0627\u0631\u0633\u06cc \u0628\u0627 `npm install` \u0648 API \u0627\u0633\u062a.",
    "",
    "This is an English paragraph with `inline code`.",
    "",
    "> \u0627\u06cc\u0646 \u06cc\u06a9 \u0646\u0642\u0644 \u0642\u0648\u0644 \u0641\u0627\u0631\u0633\u06cc \u0627\u0633\u062a.",
    "",
    "- \u0622\u06cc\u062a\u0645 \u0627\u0648\u0644 \u0641\u0627\u0631\u0633\u06cc",
    "- item second English",
    "",
    "1. \u0645\u0631\u062d\u0644\u0647 \u0627\u0648\u0644",
    "2. step second English",
    "",
    "```js",
    "console.log('\u0633\u0644\u0627\u0645')",
    "```",
  ].join("\n")
  const output = formatRtlText(input, "auto", options)

  assert.match(output, /^# \u2067\u0639\u0646\u0648\u0627\u0646 \u0641\u0627\u0631\u0633\u06cc\u2069/m)
  assert.match(output, /<div dir="rtl" align="right">\n\n\u2067\u0627\u06cc\u0646 \u06cc\u06a9/)
  assert.match(output, /This is an English paragraph with `inline code`\./)
  assert.match(output, /^> \u2067\u0627\u06cc\u0646 \u06cc\u06a9 \u0646\u0642\u0644 \u0642\u0648\u0644 \u0641\u0627\u0631\u0633\u06cc \u0627\u0633\u062a\.\u2069/m)
  assert.match(output, /^- \u2067\u0622\u06cc\u062a\u0645 \u0627\u0648\u0644 \u0641\u0627\u0631\u0633\u06cc\u2069/m)
  assert.match(output, /^- item second English$/m)
  assert.match(output, /^1\. \u2067\u0645\u0631\u062d\u0644\u0647 \u0627\u0648\u0644\u2069/m)
  assert.match(output, /^2\. step second English$/m)
  assert.match(output, /```js\nconsole\.log\('\u0633\u0644\u0627\u0645'\)\n```/)
})

test("converts digits only when requested", () => {
  const options = normalizeOptions({ digitMode: "eastern-arabic" })
  const output = formatRtlText("\u0634\u0645\u0627\u0631\u0647 123", "auto", options)
  assert.match(output, /\u06f1\u06f2\u06f3/)
})

test("strips bidi controls", () => {
  assert.equal(stripDirectionalControls("\u2067abc\u2069"), "abc")
})

test("creates system guidance", () => {
  const prompt = systemPrompt(normalizeOptions({ language: "fa" }))
  assert.ok(prompt?.includes("Persian"))
  assert.ok(prompt?.includes("code blocks"))
})
