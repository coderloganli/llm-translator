# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LLM Translator is a Chrome extension (Manifest V3) that translates selected text on web pages using either Ollama (local LLM) or OpenAI GPT API.

## Architecture

**Extension Components:**
- `manifest.json` - Chrome extension manifest (Manifest V3)
- `background.js` - Service worker handling translation API requests (Ollama and OpenAI)
- `content.js` - Content script injected into pages for text selection and DOM manipulation
- `popup.html` / `popup.js` - Extension popup UI for settings and page-level actions
- `styles.css` - Styles for the translate button and translated text highlighting

**Data Flow:**
1. User selects text on page â†?content script shows translate button
2. User clicks translate â†?content script sends message to background service worker
3. Background worker calls Ollama or OpenAI API â†?returns translation
4. Content script replaces selected text with translated text (wrapped in span for revert)

**Key State Management:**
- `chrome.storage.sync` stores user settings (provider, language, model, API keys)
- `translationState` WeakMap in content.js tracks original/translated text per element
- Translated text uses data attributes (`data-original-text`, `data-translated-text`, `data-showing`) for toggle/revert

## Development

**Loading the extension:**
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory

**Testing changes:**
- After modifying `background.js`: Click the refresh icon on the extension card
- After modifying `content.js` or `styles.css`: Refresh the target web page
- After modifying `popup.html` or `popup.js`: Close and reopen the popup

**Ollama setup for local testing:**
```bash
OLLAMA_ORIGINS=* ollama serve
```
The `OLLAMA_ORIGINS=*` environment variable is required to allow CORS requests from the extension.

## API Integration

**Ollama (default):** `POST {ollamaUrl}/api/generate` with `stream: false`
**OpenAI:** `POST https://api.openai.com/v1/chat/completions`

Both use temperature 0.3 for consistent translations.

