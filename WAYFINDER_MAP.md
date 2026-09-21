# Wayfinder Map

## Destination

Working prototype for provider setup/onboarding in Interpreter Workstation that lets users connect existing Codex CLI Pro and Claude Code Pro subscriptions and use their models via a local proxy integrated inside Workstation. Prototype demonstrates onboarding flow and proxy exposing models as OpenAI-compatible providers to the OIX app-server.

## Notes

Domain: provider onboarding, proxy bridging, CLI subscription integration
Skills to consult: domain-modeling, grilling, prototype
Standing preferences: in-process Node service, per-agent scope, inside Workstation

## Decisions so far

- Destination naming: Working proxy implementation for Codex CLI Pro + Claude Code Pro only, proxy lives inside Workstation, success criteria working prototype
- Proxy runtime: In-process Node service
- Security boundaries: Per-agent scope

## Tickets

- [Research existing Claude Code proxy implementations on GitHub](https://github.com/topics/claude-code-proxy): ccNexus, dario, claude-code-gpt-5-codex, etc. Need OpenAI-compatible proxy examples.
- [Research Codex CLI Pro auth/config extraction]: Determine config location, key storage, subscription token reuse.
- [Prototype proxy architecture]: OpenAI Responses compatible proxy similar to codex-responses-api-proxy for Codex and Claude Code.
- [Define onboarding UX flow]: Provider setup UI for connecting CLI subscriptions.

## Not yet specified

- How to authenticate to Codex CLI Pro / Claude Code Pro subscriptions without user API keys
- Best protocol for proxy: OpenAI Responses vs Chat Completions vs ACP
- Existing GitHub code for Claude Code proxy to reuse
- How to extract credentials from CLI config safely
- Onboarding UX steps for connecting CLI subscriptions
- Per-agent scope enforcement through proxy
- Harness selection for bridged models

## Out of scope

