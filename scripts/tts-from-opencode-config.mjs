#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { homedir } from "node:os"

const args = parseArgs(process.argv.slice(2))
const configPath = resolvePath(args.config ?? "~/.config/opencode/opencode.json")
const providerName = args.provider ?? "aipanel"
const model = args.model ?? "gpt-4o-mini-tts"
const voice = args.voice ?? "alloy"
const format = args.format ?? "mp3"
const output = resolve(args.output ?? `tts-test.${format}`)
const text = args.text ?? "Hello, this is a temporary API based text to speech test."
const endpoint = args.endpoint ?? "audio/speech"

if (providerName === "google-translate") {
  await runGoogleTranslateTTS({ text, output })
  process.exit(0)
}

const config = JSON.parse(await readFile(configPath, "utf8"))
const provider = config.provider?.[providerName]

if (!provider) {
  fail(`Provider '${providerName}' was not found in ${configPath}`)
}

const baseURL = provider.options?.baseURL
const apiKey = resolveValue(provider.options?.apiKey)

if (!baseURL) fail(`Provider '${providerName}' has no options.baseURL`)
if (!apiKey) fail(`Provider '${providerName}' has no usable options.apiKey`)

const speechURL = joinURL(baseURL, endpoint)
const response = await fetch(speechURL, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    voice,
    input: text,
    response_format: format,
  }),
})

const contentType = response.headers.get("content-type") ?? ""
const body = Buffer.from(await response.arrayBuffer())

if (!response.ok) {
  const diagnostic = await testChatCompletions(baseURL, apiKey)
  fail([
    `TTS request failed: HTTP ${response.status} ${response.statusText}`,
    `Endpoint: ${speechURL}`,
    `Response: ${body.toString("utf8").slice(0, 2000)}`,
    `Note: Sub2API deployments commonly expose chat/responses routes but not OpenAI /audio/speech TTS.`,
    `Verified fallback: --provider google-translate`,
    diagnostic,
  ].filter(Boolean).join("\n"))
}

if (contentType.includes("application/json")) {
  fail(`Expected audio, got JSON: ${body.toString("utf8").slice(0, 2000)}`)
}

await mkdir(dirname(output), { recursive: true })
await writeFile(output, body)

console.log(`Wrote ${body.length} bytes to ${output}`)
console.log(`Content-Type: ${contentType || "unknown"}`)

function parseArgs(values) {
  const parsed = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith("--")) continue
    const key = value.slice(2)
    const next = values[index + 1]
    if (!next || next.startsWith("--")) {
      parsed[key] = "true"
      continue
    }
    parsed[key] = next
    index += 1
  }
  return parsed
}

function resolvePath(path) {
  if (path === "~") return homedir()
  if (path.startsWith("~/")) return resolve(homedir(), path.slice(2))
  return resolve(path)
}

function resolveValue(value) {
  if (!value) return undefined
  const envMatch = /^\{env:([^}]+)\}$/.exec(value)
  if (envMatch) return process.env[envMatch[1]]
  return value
}

function joinURL(baseURL, path) {
  return `${baseURL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`
}

async function runGoogleTranslateTTS({ text, output }) {
  const url = new URL("https://translate.google.com/translate_tts")
  url.searchParams.set("ie", "UTF-8")
  url.searchParams.set("client", "tw-ob")
  url.searchParams.set("tl", "en")
  url.searchParams.set("q", text)

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  })
  const contentType = response.headers.get("content-type") ?? ""
  const body = Buffer.from(await response.arrayBuffer())

  if (!response.ok) {
    fail(`Google Translate TTS failed: HTTP ${response.status} ${response.statusText}\n${body.toString("utf8").slice(0, 2000)}`)
  }
  if (!contentType.includes("audio")) {
    fail(`Expected audio, got ${contentType || "unknown"}: ${body.toString("utf8").slice(0, 2000)}`)
  }

  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, body)
  console.log(`Wrote ${body.length} bytes to ${output}`)
  console.log(`Content-Type: ${contentType || "unknown"}`)
}

async function testChatCompletions(baseURL, apiKey) {
  try {
    const chatResponse = await fetch(joinURL(baseURL, "chat/completions"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.5",
        messages: [{ role: "user", content: "Reply with exactly: ok" }],
      }),
    })
    const text = await chatResponse.text()
    return `Chat completions diagnostic: HTTP ${chatResponse.status} ${chatResponse.statusText}; ${text.slice(0, 500)}`
  } catch (error) {
    return `Chat completions diagnostic failed: ${error instanceof Error ? error.message : String(error)}`
  }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
