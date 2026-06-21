import type { Hooks, Plugin, PluginModule, PluginOptions } from "@opencode-ai/plugin"
import {
  PLUGIN_ID,
  analyzeDirection,
  formatRtlText,
  normalizeOptions,
  statusText,
  systemPrompt,
  type NormalizedRtlOptions,
} from "./core.js"

type MutableRecord = Record<string, unknown>

export const server: Plugin = async ({ client }, options?: PluginOptions) => {
  const settings = normalizeOptions(options)
  await log(client, settings, "info", "initialized", { status: statusText(settings) })

  const hooks: Hooks = {
    "experimental.chat.system.transform": async (_input, output) => {
      const prompt = systemPrompt(settings)
      if (prompt) output.system.push(prompt)
      await log(client, settings, "debug", "system guidance applied", { enabled: Boolean(prompt) })
    },

    "chat.message": async (_input, output) => {
      if (!settings.enabled || settings.isolateUserMessages === "off") return

      for (const part of output.parts) {
        mutateTextFields(part, (value) => formatRtlText(value, settings.isolateUserMessages, settings))
      }
      mutateTextFields(output.message as unknown, (value) => formatRtlText(value, settings.isolateUserMessages, settings))
    },

    "experimental.chat.messages.transform": async (_input, output) => {
      if (!settings.enabled || settings.isolateUserMessages === "off") return

      for (const message of output.messages) {
        for (const part of message.parts) {
          if (message.info.role === "user") {
            mutateTextFields(part, (value) => formatRtlText(value, settings.isolateUserMessages, settings))
          }
        }
      }
    },

    "experimental.text.complete": async (_input, output) => {
      if (!settings.enabled || settings.isolateAssistantText === "off") return
      output.text = formatRtlText(output.text, settings.isolateAssistantText, settings)
      await log(client, settings, "debug", "assistant text formatted")
    },

    "tool.execute.after": async (_input, output) => {
      if (!settings.enabled || settings.isolateToolOutput === "off") return
      output.output = formatRtlText(output.output, settings.isolateToolOutput, settings)
    },

    "shell.env": async (_input, output) => {
      if (!settings.directionEnv) return
      output.env.OPENCODE_RTL = settings.enabled ? "1" : "0"
      output.env.OPENCODE_RTL_LANGUAGE = settings.language
      output.env.OPENCODE_RTL_USER_ISOLATION = settings.isolateUserMessages
      output.env.OPENCODE_RTL_ASSISTANT_ISOLATION = settings.isolateAssistantText
    },
  }

  return hooks
}

export const RtlPlugin = server

export default {
  id: PLUGIN_ID,
  server,
} satisfies PluginModule

function mutateTextFields(value: unknown, format: (value: string) => string) {
  if (!isMutableRecord(value)) return

  for (const key of ["text", "content", "value"]) {
    const current = value[key]
    if (typeof current !== "string") continue
    if (!shouldFormatTextField(key, current)) continue
    value[key] = format(current)
  }
}

function shouldFormatTextField(key: string, value: string) {
  if (!value.trim()) return false
  if (key === "value" && analyzeDirection(value).direction !== "rtl") return false
  return true
}

function isMutableRecord(value: unknown): value is MutableRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function log(
  client: unknown,
  settings: NormalizedRtlOptions,
  level: "debug" | "info" | "warn" | "error",
  message: string,
  extra?: Record<string, unknown>,
) {
  if (!settings.debug) return
  const maybeClient = client as { app?: { log?: (input: { body: Record<string, unknown> }) => Promise<unknown> } }
  await maybeClient.app?.log?.({
    body: {
      service: PLUGIN_ID,
      level,
      message,
      extra,
    },
  })
}
