export const PLUGIN_ID = "opencode-rtl"

export const RTL_LANGUAGES = ["ar", "fa", "he", "ur", "ps", "sd", "yi", "dv", "ug", "ku"] as const

export type RtlLanguage = (typeof RTL_LANGUAGES)[number]
export type LanguageOption = "auto" | "none" | RtlLanguage
export type Direction = "rtl" | "ltr" | "neutral"
export type IsolationMode = "off" | "auto" | "always"
export type IsolationOption = boolean | IsolationMode
export type DigitMode = "preserve" | "latin" | "arabic-indic" | "eastern-arabic"
export type ForceDirection = "auto" | "rtl" | "ltr"
export type RtlWrapper = "off" | "auto" | "always"

export type RtlPluginOptions = {
  enabled?: boolean
  language?: LanguageOption
  systemGuidance?: boolean | string
  isolateUserMessages?: IsolationOption
  isolateAssistantText?: IsolationOption
  isolateToolOutput?: IsolationOption
  minRtlRatio?: number
  minRtlCharacters?: number
  digitMode?: DigitMode
  forceDirection?: ForceDirection
  alignRtlParagraphs?: boolean
  rtlWrapColumn?: number
  rtlAlignColumn?: number
  wrapRtlMarkdown?: RtlWrapper
  directionEnv?: boolean
  includeLanguageHint?: boolean
  notifyOnStart?: boolean
  debug?: boolean
}

export type NormalizedRtlOptions = {
  enabled: boolean
  language: LanguageOption
  systemGuidance: boolean | string
  isolateUserMessages: IsolationMode
  isolateAssistantText: IsolationMode
  isolateToolOutput: IsolationMode
  minRtlRatio: number
  minRtlCharacters: number
  digitMode: DigitMode
  forceDirection: ForceDirection
  alignRtlParagraphs: boolean
  rtlWrapColumn: number
  rtlAlignColumn: number
  wrapRtlMarkdown: RtlWrapper
  directionEnv: boolean
  includeLanguageHint: boolean
  notifyOnStart: boolean
  debug: boolean
}

export type DirectionAnalysis = {
  direction: Direction
  language: RtlLanguage | "unknown" | "none"
  rtlCharacters: number
  ltrCharacters: number
  rtlRatio: number
}

const RLI = "\u2067"
const LRI = "\u2066"
const PDI = "\u2069"
const NBSP = "\u00a0"

const RTL_GLOBAL =
  /[\u0590-\u05ff\u0600-\u06ff\u0700-\u074f\u0750-\u077f\u0780-\u07bf\u07c0-\u07ff\u0800-\u083f\u0840-\u085f\u0860-\u086f\u0870-\u089f\u08a0-\u08ff\ufb1d-\ufdff\ufe70-\ufeff\u{10800}-\u{10fff}\u{1e800}-\u{1e95f}]/gu
const LTR_GLOBAL = /[A-Za-z\u00c0-\u02af\u0370-\u052f]/gu
const DIRECTIONAL_CONTROLS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu
const HEBREW = /[\u0590-\u05ff]/u
const URDU = /[\u0679\u0688\u0691\u06ba\u06be\u06c1-\u06c3\u06d2]/u
const PERSIAN = /[\u067e\u0686\u0698\u06af]/u
const ARABIC = /[\u0600-\u06ff\u0750-\u077f\u0870-\u089f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u
const THAANA = /[\u0780-\u07bf]/u
const YIDDISH = /[\u05f0-\u05f4]/u

const DEFAULT_OPTIONS: NormalizedRtlOptions = {
  enabled: true,
  language: "auto",
  systemGuidance: true,
  isolateUserMessages: "auto",
  isolateAssistantText: "auto",
  isolateToolOutput: "off",
  minRtlRatio: 0.2,
  minRtlCharacters: 2,
  digitMode: "preserve",
  forceDirection: "auto",
  alignRtlParagraphs: false,
  rtlWrapColumn: 96,
  rtlAlignColumn: 96,
  wrapRtlMarkdown: "off",
  directionEnv: true,
  includeLanguageHint: true,
  notifyOnStart: false,
  debug: false,
}

export function normalizeOptions(input: unknown): NormalizedRtlOptions {
  const raw = isRecord(input) ? input : {}
  return {
    enabled: readBoolean(raw.enabled, DEFAULT_OPTIONS.enabled),
    language: readLanguage(raw.language, DEFAULT_OPTIONS.language),
    systemGuidance: readSystemGuidance(raw.systemGuidance, DEFAULT_OPTIONS.systemGuidance),
    isolateUserMessages: readIsolation(raw.isolateUserMessages, DEFAULT_OPTIONS.isolateUserMessages),
    isolateAssistantText: readIsolation(raw.isolateAssistantText, DEFAULT_OPTIONS.isolateAssistantText),
    isolateToolOutput: readIsolation(raw.isolateToolOutput, DEFAULT_OPTIONS.isolateToolOutput),
    minRtlRatio: readNumber(raw.minRtlRatio, DEFAULT_OPTIONS.minRtlRatio, 0, 1),
    minRtlCharacters: Math.max(0, Math.trunc(readNumber(raw.minRtlCharacters, DEFAULT_OPTIONS.minRtlCharacters, 0, 1000))),
    digitMode: readDigitMode(raw.digitMode, DEFAULT_OPTIONS.digitMode),
    forceDirection: readForceDirection(raw.forceDirection, DEFAULT_OPTIONS.forceDirection),
    alignRtlParagraphs: readBoolean(raw.alignRtlParagraphs, DEFAULT_OPTIONS.alignRtlParagraphs),
    rtlWrapColumn: Math.trunc(readNumber(raw.rtlWrapColumn, DEFAULT_OPTIONS.rtlWrapColumn, 20, 240)),
    rtlAlignColumn: Math.trunc(readNumber(raw.rtlAlignColumn, DEFAULT_OPTIONS.rtlAlignColumn, 20, 240)),
    wrapRtlMarkdown: readRtlWrapper(raw.wrapRtlMarkdown, DEFAULT_OPTIONS.wrapRtlMarkdown),
    directionEnv: readBoolean(raw.directionEnv, DEFAULT_OPTIONS.directionEnv),
    includeLanguageHint: readBoolean(raw.includeLanguageHint, DEFAULT_OPTIONS.includeLanguageHint),
    notifyOnStart: readBoolean(raw.notifyOnStart, DEFAULT_OPTIONS.notifyOnStart),
    debug: readBoolean(raw.debug, DEFAULT_OPTIONS.debug),
  }
}

export function analyzeDirection(text: string, options: Pick<NormalizedRtlOptions, "language" | "minRtlCharacters" | "minRtlRatio"> = DEFAULT_OPTIONS): DirectionAnalysis {
  if (options.language === "none") {
    return { direction: "ltr", language: "none", rtlCharacters: 0, ltrCharacters: 0, rtlRatio: 0 }
  }

  const rtlCharacters = countMatches(text, RTL_GLOBAL)
  const ltrCharacters = countMatches(text, LTR_GLOBAL)
  const directionalCharacters = rtlCharacters + ltrCharacters
  const rtlRatio = directionalCharacters === 0 ? 0 : rtlCharacters / directionalCharacters
  const detectedLanguage = options.language === "auto" ? detectLanguage(text) : options.language

  if (options.language !== "auto" && isRtlLanguage(options.language)) {
    return { direction: "rtl", language: options.language, rtlCharacters, ltrCharacters, rtlRatio }
  }

  if (rtlCharacters >= options.minRtlCharacters && rtlRatio >= options.minRtlRatio) {
    return { direction: "rtl", language: detectedLanguage, rtlCharacters, ltrCharacters, rtlRatio }
  }

  if (directionalCharacters === 0) {
    return { direction: "neutral", language: detectedLanguage, rtlCharacters, ltrCharacters, rtlRatio }
  }

  return { direction: "ltr", language: detectedLanguage, rtlCharacters, ltrCharacters, rtlRatio }
}

export function detectLanguage(text: string): RtlLanguage | "unknown" {
  if (YIDDISH.test(text)) return "yi"
  if (HEBREW.test(text)) return "he"
  if (THAANA.test(text)) return "dv"
  if (URDU.test(text)) return "ur"
  if (PERSIAN.test(text)) return "fa"
  if (ARABIC.test(text)) return "ar"
  return "unknown"
}

export function formatRtlText(text: string, mode: IsolationMode, options: NormalizedRtlOptions): string {
  if (!options.enabled) return text
  if (mode === "off" && options.digitMode === "preserve") return text

  if (options.wrapRtlMarkdown !== "off") {
    return wrapMarkdownRtl(text, mode, options)
  }

  let inFence = false
  const parts = text.split(/(\r?\n)/)

  return parts
    .map((part) => {
      if (part === "\n" || part === "\r\n") return part
      const trimmed = part.trimStart()
      const fence = trimmed.startsWith("```") || trimmed.startsWith("~~~")
      if (fence) {
        inFence = !inFence
        return part
      }
      if (inFence || isIndentedCode(part)) return part

      const withDigits = applyDigitMode(part, options.digitMode)
      if (mode === "off") return withDigits
      if (isAlreadyIsolated(withDigits)) return withDigits

      const analysis = analyzeDirection(withDigits, options)
      const forcedDirection = options.forceDirection === "auto" ? undefined : options.forceDirection
      if (mode === "auto" && !forcedDirection && analysis.direction !== "rtl") return withDigits

      return formatMarkdownLine(withDigits, forcedDirection ?? (analysis.direction === "rtl" ? "rtl" : "ltr"), options)
    })
    .join("")
}

export function stripDirectionalControls(text: string): string {
  return text.replace(DIRECTIONAL_CONTROLS, "")
}

export function systemPrompt(options: NormalizedRtlOptions): string | undefined {
  if (!options.enabled || options.systemGuidance === false) return undefined
  if (options.language === "none") return undefined
  if (typeof options.systemGuidance === "string") return options.systemGuidance

  const language = options.language === "auto" ? "the user's RTL language" : languageName(options.language)
  const guidance = [
    "RTL language support is active.",
    `When the user writes in ${language}, answer in that same language unless they explicitly ask otherwise.`,
    "Preserve Markdown structure while making RTL prose natural and readable.",
    "Keep code blocks, shell commands, file paths, identifiers, URLs, logs, and API names left-to-right and unchanged.",
    "Do not translate code, command output, stack traces, package names, or file names unless the user explicitly asks for translation.",
    "For mixed RTL/LTR text, keep technical tokens close to their explanation and avoid reordering punctuation around code spans.",
  ]

  if (options.includeLanguageHint) {
    guidance.splice(1, 0, `RTL language context: ${language}.`)
  }

  return guidance.join("\n")
}

export function languageName(language: LanguageOption): string {
  switch (language) {
    case "ar":
      return "Arabic"
    case "fa":
      return "Persian"
    case "he":
      return "Hebrew"
    case "ur":
      return "Urdu"
    case "ps":
      return "Pashto"
    case "sd":
      return "Sindhi"
    case "yi":
      return "Yiddish"
    case "dv":
      return "Divehi"
    case "ug":
      return "Uyghur"
    case "ku":
      return "Kurdish"
    case "none":
      return "left-to-right text"
    case "auto":
      return "auto-detected RTL text"
  }
}

export function statusText(options: NormalizedRtlOptions): string {
  return [
    `enabled=${String(options.enabled)}`,
    `language=${options.language}`,
    `user=${options.isolateUserMessages}`,
    `assistant=${options.isolateAssistantText}`,
    `tools=${options.isolateToolOutput}`,
    `digits=${options.digitMode}`,
    `force=${options.forceDirection}`,
    `align=${String(options.alignRtlParagraphs)}`,
    `wrap=${options.wrapRtlMarkdown}`,
  ].join(" ")
}

export function isRtlLanguage(language: LanguageOption): language is RtlLanguage {
  return RTL_LANGUAGES.includes(language as RtlLanguage)
}

function formatMarkdownLine(line: string, direction: "rtl" | "ltr", options: NormalizedRtlOptions) {
  const { marker, content } = splitMarkdownLine(line)
  if (!content.trim()) return line
  if (direction === "rtl" && options.alignRtlParagraphs) {
    return alignRtlContent(marker, content, options)
  }
  return `${marker}${isolate(content, direction)}`
}

function splitMarkdownLine(line: string) {
  const prefix = line.match(/^(\s*(?:(?:[-*+] |\d+\. |#{1,6} |> )?))(.*)$/u)
  if (!prefix) return { marker: "", content: line }
  return { marker: prefix[1] ?? "", content: prefix[2] ?? "" }
}

function alignRtlContent(marker: string, content: string, options: NormalizedRtlOptions) {
  const chunks = wrapVisualText(content.trim(), options.rtlWrapColumn)
  const continuationMarker = marker.replace(/\S/gu, NBSP)

  return chunks
    .map((chunk, index) => {
      const prefix = index === 0 ? marker : continuationMarker
      const isolated = isolate(chunk, "rtl")
      const padding = Math.max(0, options.rtlAlignColumn - visualWidth(chunk) - visualWidth(prefix))
      return `${prefix}${NBSP.repeat(padding)}${isolated}`
    })
    .join("\n")
}

function isolate(text: string, direction: "rtl" | "ltr") {
  return `${direction === "rtl" ? RLI : LRI}${text}${PDI}`
}

function wrapMarkdownRtl(text: string, mode: IsolationMode, options: NormalizedRtlOptions) {
  return splitMarkdownBlocks(text)
    .map((block) => {
      if (block.kind !== "text") return block.value
      const body = formatRtlTextWithoutMarkdownWrapper(block.value, mode, options)
      if (options.wrapRtlMarkdown !== "always" && analyzeDirection(block.value, options).direction !== "rtl") return body
      if (!canWrapMarkdownBlock(block.value)) return body
      return `<div dir="rtl" align="right">\n\n${body}\n\n</div>`
    })
    .join("")
}

function formatRtlTextWithoutMarkdownWrapper(text: string, mode: IsolationMode, options: NormalizedRtlOptions) {
  return formatRtlText(text, mode, { ...options, wrapRtlMarkdown: "off" })
}

type MarkdownBlock =
  | {
      kind: "text"
      value: string
    }
  | {
      kind: "raw"
      value: string
    }

function splitMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split(/(\r?\n)/)
  const blocks: MarkdownBlock[] = []
  let current = ""
  let inFence = false
  let fence = ""

  function pushText() {
    if (!current) return
    blocks.push({ kind: "text", value: current })
    current = ""
  }

  function pushRaw(value: string) {
    blocks.push({ kind: "raw", value })
  }

  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index] ?? ""
    const newline = lines[index + 1] ?? ""
    const fullLine = `${line}${newline}`
    const trimmed = line.trimStart()
    const fenceStart = trimmed.startsWith("```") ? "```" : trimmed.startsWith("~~~") ? "~~~" : ""

    if (inFence) {
      current += fullLine
      if (fence && trimmed.startsWith(fence)) {
        pushRaw(current)
        current = ""
        inFence = false
        fence = ""
      }
      continue
    }

    if (fenceStart) {
      pushText()
      current = fullLine
      inFence = true
      fence = fenceStart
      continue
    }

    if (!line.trim()) {
      current += fullLine
      pushText()
      continue
    }

    current += fullLine
  }

  if (current) {
    blocks.push({ kind: inFence ? "raw" : "text", value: current })
  }

  return blocks
}

function canWrapMarkdownBlock(block: string) {
  const lines = block.split(/\r?\n/u).filter((line) => line.trim())
  if (!lines.length) return false

  return lines.every((line) => {
    const trimmed = line.trimStart()
    if (/^(#{1,6}\s|>\s?|[-*+]\s|\d+\.\s)/u.test(trimmed)) return false
    if (/^\|.*\|\s*$/u.test(trimmed)) return false
    if (/^<\/?[A-Za-z][^>]*>/u.test(trimmed)) return false
    if (isIndentedCode(line)) return false
    return true
  })
}

function isAlreadyIsolated(text: string) {
  const value = text.trim()
  return (value.startsWith(RLI) || value.startsWith(LRI)) && value.endsWith(PDI)
}

function isIndentedCode(line: string) {
  return /^\s{4,}\S/u.test(line) && !/^\s{4,}[-*+]\s/u.test(line)
}

function applyDigitMode(text: string, mode: DigitMode): string {
  if (mode === "preserve") return text
  return text.replace(/[0-9\u0660-\u0669\u06f0-\u06f9]/gu, (digit) => convertDigit(digit, mode))
}

function wrapVisualText(text: string, column: number) {
  const words = text.split(/\s+/u).filter(Boolean)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const pieces = splitLongWord(word, column)
    for (const piece of pieces) {
      if (!current) {
        current = piece
        continue
      }
      const next = `${current} ${piece}`
      if (visualWidth(next) <= column) {
        current = next
        continue
      }
      lines.push(current)
      current = piece
    }
  }

  if (current) lines.push(current)
  return lines.length ? lines : [text]
}

function splitLongWord(word: string, column: number) {
  if (visualWidth(word) <= column) return [word]

  const chunks: string[] = []
  let current = ""
  for (const char of word) {
    if (current && visualWidth(`${current}${char}`) > column) {
      chunks.push(current)
      current = char
      continue
    }
    current += char
  }
  if (current) chunks.push(current)
  return chunks
}

function visualWidth(text: string) {
  let width = 0
  for (const char of stripDirectionalControls(text)) {
    if (/\p{Mark}/u.test(char)) continue
    const code = char.codePointAt(0) ?? 0
    width += isWideCodePoint(code) ? 2 : 1
  }
  return width
}

function isWideCodePoint(code: number) {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    code === 0x2329 ||
    code === 0x232a ||
    (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1faff)
  )
}

function convertDigit(digit: string, mode: Exclude<DigitMode, "preserve">): string {
  const code = digit.codePointAt(0) ?? 0
  let value = 0
  if (code >= 0x30 && code <= 0x39) value = code - 0x30
  else if (code >= 0x660 && code <= 0x669) value = code - 0x660
  else if (code >= 0x6f0 && code <= 0x6f9) value = code - 0x6f0

  if (mode === "latin") return String(value)
  if (mode === "arabic-indic") return String.fromCodePoint(0x660 + value)
  return String.fromCodePoint(0x6f0 + value)
}

function countMatches(text: string, pattern: RegExp) {
  pattern.lastIndex = 0
  let count = 0
  while (pattern.exec(text)) count++
  return count
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function readNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function readSystemGuidance(value: unknown, fallback: boolean | string) {
  if (typeof value === "boolean" || typeof value === "string") return value
  return fallback
}

function readIsolation(value: unknown, fallback: IsolationMode): IsolationMode {
  if (value === true) return "auto"
  if (value === false) return "off"
  if (value === "off" || value === "auto" || value === "always") return value
  return fallback
}

function readLanguage(value: unknown, fallback: LanguageOption): LanguageOption {
  if (value === "auto" || value === "none" || isRtlLanguage(value as LanguageOption)) return value as LanguageOption
  return fallback
}

function readDigitMode(value: unknown, fallback: DigitMode): DigitMode {
  if (value === "preserve" || value === "latin" || value === "arabic-indic" || value === "eastern-arabic") return value
  return fallback
}

function readForceDirection(value: unknown, fallback: ForceDirection): ForceDirection {
  if (value === "auto" || value === "rtl" || value === "ltr") return value
  return fallback
}

function readRtlWrapper(value: unknown, fallback: RtlWrapper): RtlWrapper {
  if (value === "off" || value === "auto" || value === "always") return value
  return fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
