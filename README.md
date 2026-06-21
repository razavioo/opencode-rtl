# opencode-rtl

Comprehensive right-to-left language support for opencode. The plugin improves mixed RTL/LTR conversations in terminal sessions while preserving code, commands, file paths, logs, and other technical text.

## Features

- Adds model guidance for Arabic, Persian, Hebrew, Urdu, Pashto, Sindhi, Yiddish, Divehi, Uyghur, and Kurdish workflows.
- Detects RTL text with Unicode script ranges and language-specific hints.
- Wraps RTL prose with Unicode bidirectional isolates so nearby LTR tokens stay readable.
- Optionally hard-wraps and pads RTL paragraphs so wrapped lines remain visually right-aligned in opencode's TUI.
- Leaves fenced code blocks and indented code untouched.
- Optionally normalizes Arabic-Indic, Eastern Arabic, or Latin digits.
- Exposes TUI commands for plugin status and RTL detection checks.
- Exports reusable text utilities for custom opencode plugins.

## Install

### From npm

Add the plugin to `opencode.json` or `~/.config/opencode/opencode.json`.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-rtl"]
}
```

### With options

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "opencode-rtl",
      {
        "language": "auto",
        "systemGuidance": true,
        "isolateUserMessages": "auto",
        "isolateAssistantText": "auto",
        "isolateToolOutput": "off",
        "digitMode": "preserve",
        "alignRtlParagraphs": false,
        "rtlWrapColumn": 96,
        "rtlAlignColumn": 96
      }
    ]
  ]
}
```

### Local development

This repository includes `opencode.json` so opencode can load the plugin from the project during development.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [["./", { "language": "auto" }]]
}
```

Restart opencode after changing plugin files or config. opencode loads plugins once at startup.

To confirm opencode sees the project config, run this from the repository root:

```sh
opencode debug config
```

The output should contain `file:///home/razavioo/StudioProjects/opencode-rtl` in the `plugin` array.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Enables all plugin behavior. |
| `language` | `"auto" \| "none" \| RTL language code` | `"auto"` | Auto-detects or forces the RTL language context. |
| `systemGuidance` | `boolean \| string` | `true` | Adds built-in guidance or a custom system prompt. |
| `isolateUserMessages` | `"off" \| "auto" \| "always" \| boolean` | `"auto"` | Applies Unicode bidi isolation to user text sent to models. |
| `isolateAssistantText` | `"off" \| "auto" \| "always" \| boolean` | `"auto"` | Applies Unicode bidi isolation to generated assistant text. |
| `isolateToolOutput` | `"off" \| "auto" \| "always" \| boolean` | `"off"` | Applies isolation to tool output. Keep off if exact copy/paste matters. |
| `minRtlRatio` | `number` | `0.2` | Minimum RTL character ratio for automatic RTL detection. |
| `minRtlCharacters` | `number` | `2` | Minimum RTL characters needed for automatic detection. |
| `digitMode` | `"preserve" \| "latin" \| "arabic-indic" \| "eastern-arabic"` | `"preserve"` | Optional digit conversion outside code blocks. |
| `forceDirection` | `"auto" \| "rtl" \| "ltr"` | `"auto"` | Forces bidi isolate direction when automatic detection is not enough. |
| `alignRtlParagraphs` | `boolean` | `false` | Terminal-only hard-wrap/padding workaround. This is not the RTL detection switch. |
| `rtlWrapColumn` | `number` | `96` | Maximum visual width before the plugin inserts real line breaks. |
| `rtlAlignColumn` | `number` | `96` | Visual column used for right padding. Match this to your opencode message width. |
| `wrapRtlMarkdown` | `"off" \| "auto" \| "always"` | `"off"` | Experimental output-only Markdown wrapper for renderers that honor inline HTML. Keep off for normal use. |
| `directionEnv` | `boolean` | `true` | Exposes RTL settings to shell tools through `OPENCODE_RTL_*` env vars. |
| `includeLanguageHint` | `boolean` | `true` | Adds an explicit language-context line to the system guidance. |
| `notifyOnStart` | `boolean` | `false` | Shows a TUI toast when the plugin loads. Useful for setup checks. |
| `debug` | `boolean` | `false` | Writes plugin initialization details through `client.app.log()`. |

Supported language codes: `ar`, `fa`, `he`, `ur`, `ps`, `sd`, `yi`, `dv`, `ug`, `ku`.

## TUI Commands

Open the command palette and run:

- `RTL: Show Status` to display active options.
- `RTL: Analyze Sample` to verify direction and language detection.

## Direction Detection

The plugin treats mixed text as RTL when at least `minRtlCharacters` RTL characters are present and the RTL ratio is at least `minRtlRatio`. With the default `minRtlRatio: 0.2`, a paragraph that is mostly Persian with some English identifiers, paths, or package names is still handled as RTL.

```json
{
  "minRtlRatio": 0.2,
  "minRtlCharacters": 2,
  "forceDirection": "auto"
}
```

Use `forceDirection: "rtl"` only if you want every formatted assistant/user text segment to be treated as RTL regardless of detected content.

## Web Layout

`opencode web` controls the prompt input and outer message column in its own UI. Without changing opencode itself, the plugin can only influence text after it leaves or enters model hooks. Optionally set `wrapRtlMarkdown: "auto"` to wrap each detected RTL output paragraph in an inline HTML paragraph:

```html
<p dir="rtl" align="right">
RTL block only
</p>
```

LTR paragraphs and fenced code blocks are left unchanged. This option is disabled by default because inline HTML wrappers can interact poorly with some Markdown renderers. If live typing in the Ask Anything box is wrong, the fix must be upstream in opencode's Web UI prompt component.

## Terminal Alignment

opencode's terminal TUI can render soft-wrapped RTL text with correct paragraph direction but left alignment on continuation lines. Enable `alignRtlParagraphs` only for terminal TUI output, not for `opencode web`, because it inserts real line breaks and padding spaces into assistant text.

```json
{
  "alignRtlParagraphs": true,
  "rtlWrapColumn": 96,
  "rtlAlignColumn": 96
}
```

Tune `rtlAlignColumn` to the visible message width in your terminal. If the padded lines start too far left, increase it; if they overflow or wrap again, decrease it. Keep this option off for Web UI because it inserts real spacing into the message text.

## Troubleshooting

If it looks like nothing changed:

- Start opencode from this repository, or pass the project path explicitly: `opencode /home/razavioo/StudioProjects/opencode-rtl`.
- Confirm project config is loaded with `opencode debug config`; do not share the full output because it can include provider API keys.
- Look for the `RTL support loaded` toast on startup when `notifyOnStart` or `debug` is enabled.
- If automatic detection is too subtle, set `forceDirection` to `"rtl"` and `isolateAssistantText` to `"always"` in `opencode.json`.
- If RTL continuation lines appear left-aligned in terminal TUI, enable `alignRtlParagraphs` and tune `rtlAlignColumn` for your terminal width.
- If you use `opencode web`, prompt/input alignment is controlled by opencode's Web UI. This plugin cannot change that without an upstream opencode web change.
- If you use terminal TUI and mean the prompt cursor/input direction, that is controlled by opencode's TUI and your terminal, not by server-side plugin hooks.

## How It Works

opencode plugins cannot replace the terminal renderer or the host terminal font. This plugin uses the supported plugin hooks to improve RTL behavior safely:

- `experimental.chat.system.transform` injects RTL-aware response instructions.
- `chat.message` isolates RTL user message parts before model calls.
- `experimental.chat.messages.transform` keeps historical user message parts stable during context transforms.
- `experimental.text.complete` isolates assistant prose after generation.
- `tool.execute.after` can isolate tool output when explicitly enabled.
- `shell.env` exposes `OPENCODE_RTL`, `OPENCODE_RTL_LANGUAGE`, `OPENCODE_RTL_USER_ISOLATION`, and `OPENCODE_RTL_ASSISTANT_ISOLATION`.

The formatter skips fenced code blocks and indented code because invisible bidi controls inside source code, shell commands, or logs can make copying unsafe.

## Development

```sh
npm install
npm run typecheck
npm test
```

## Package Entrypoints

- `opencode-rtl/server` exports the server plugin module.
- `opencode-rtl/tui` exports the TUI plugin module.
- `opencode-rtl` exports reusable utilities plus plugin functions.

## Limitations

- Terminal shaping, glyph fallback, cursor movement, and input method behavior still depend on your terminal emulator and font.
- The opencode prompt/input widget is not replaced by this plugin; terminal cursor movement for RTL typing still depends on the TUI and terminal.
- The browser prompt/input in `opencode web` is rendered by opencode's Web UI. The current plugin API does not expose a supported hook to change its DOM direction or alignment.
- Unicode isolation improves display order but intentionally does not rewrite code, logs, paths, or command output by default.
- If exact text copy/paste is more important than visual ordering, set `isolateAssistantText` to `"off"`.
