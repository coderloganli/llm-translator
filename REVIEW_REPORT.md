# Review Report - LLM Translator
Reviewer: Codex 

Date: 2026-01-19

## Scope
- Repository review with a focus on security, privacy, and least-privilege permissions.

## Findings (ordered by severity)

### Medium - OpenAI API key stored in synced storage
- The OpenAI API key is saved to `chrome.storage.sync`, which syncs to the user’s Google account and other devices. If any synced device is compromised, the key can be exposed. The key is also rehydrated into the popup DOM on open.
- Locations: `popup.js:13-20`, `popup.js:75-84`, `background.js:26`
- Recommendation:
  - Prefer `chrome.storage.local` for secrets, or store the key in `chrome.storage.session` and ask the user per session.
  - If sync is required, add a clear warning in the UI and provide a “don’t sync keys�?toggle.

### Medium - Arbitrary Ollama URL allows silent data exfiltration
- The extension sends selected/page text to `settings.ollamaUrl` without validation. A user (or another extension manipulating storage) could set this to a remote HTTP endpoint and exfiltrate sensitive text over an unencrypted channel.
- Locations: `popup.js:50-55`, `popup.js:127-156`, `background.js:45-55`
- Recommendation:
  - Validate that the URL is `http://localhost` or `http://127.0.0.1` by default.
  - For non-local URLs, require explicit opt-in and enforce HTTPS.
  - Add a UI warning when the URL is not local.

### Medium - Content script runs on all URLs
- The content script is injected on `<all_urls>` and can access all page content on every site. This increases exposure to sensitive pages (banking, health, etc.) even though translation is user-initiated.
- Location: `manifest.json:28-33`
- Recommendation:
  - Use optional host permissions and request access per site.
  - Alternatively, inject on demand via `activeTab` and `chrome.scripting` instead of static `<all_urls>`.
  - If keeping static injection, at least limit matches to `http`/`https`.

### Low - Unused `scripting` permission
- The manifest declares `scripting` but no code uses `chrome.scripting`. This adds unnecessary privilege.
- Location: `manifest.json:6-9`
- Recommendation:
  - Remove `scripting` unless you adopt on-demand injection.

## Open questions / assumptions
- Is syncing the OpenAI API key across devices an explicit product requirement?
- Do you intend to support remote Ollama endpoints, or should they be explicitly disallowed?
- Do you want translation to work on every site, or only on user-approved domains?

## Testing / validation gaps
- No automated tests or linting detected.
- No explicit privacy notice or data handling statement is present for user consent.

