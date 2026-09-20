# Spec: CLI Subscription Proxy Provider Onboarding

## Problem Statement

Users with paid subscriptions to Codex CLI Pro and Claude Code Pro want to use the models behind those subscriptions inside Interpreter Workstation. Currently Workstation provider setup requires direct API keys for OpenAI / Anthropic or local runtimes. There is no onboarding path to detect, authenticate to, and bridge the CLI installations the user already owns, nor a proxy that exposes those CLI backends as OpenAI-compatible providers to the OIX app-server.

## Solution

Add a provider onboarding flow and an in-process proxy that can bridge Codex CLI Pro and Claude Code Pro installations to OpenAI-compatible endpoints consumed by OIX. The proxy is integrated inside Workstation, runs as an in-process Node service, respects per-agent scope, and registers a custom `model_providers` entry consumed via the existing `interpreter/provider/list`, `interpreter/model/list`, and `interpreter/harness/list` app-server contract. Onboarding guides the user to authorize the local CLI, starts the proxy, and surfaces the models in provider setup UI.

## User Stories

1. As a Workstation user with Codex CLI Pro installed, I want to connect my Codex CLI installation during provider setup, so that I can use Codex models in Interpreter without providing a separate OpenAI API key.
2. As a Workstation user with Claude Code Pro installed, I want to connect my Claude Code installation during provider setup, so that I can use Claude models in Interpreter using my existing subscription.
3. As a user, I want the onboarding flow to detect whether Codex CLI / Claude Code CLI is installed and configured, so that I am not asked for credentials I already have.
4. As a user, I want the proxy to run locally and never expose my CLI credentials externally, so that my subscription stays private.
5. As a user, I want the bridged provider to appear in the existing provider picker with model and harness selection, so that my workflow is unchanged.
6. As a user, I want per-agent file scope and approval policy to apply to calls made through the bridged provider, so that security posture is preserved.
7. As a user, I want clear error messages when CLI is not installed, misconfigured, or rate limited, so I can fix the issue.
8. As a user, I want to disconnect / disable the CLI bridge at any time from provider settings, so I can revoke access.
9. As an operator, I want the proxy to be an OpenAI Responses/Chat Completions compatible endpoint, so OIX can consume it without new runtime changes.
10. As a developer, I want the proxy to be implemented as a single seam behind the existing `providers` IPC surface, so changes are minimal and testable.
11. As a user, I want the onboarding to work on macOS, Windows, and Linux, so my platform is supported.
12. As a user, I want the proxy to be started and stopped with Workstation lifecycle, so I do not manage separate processes.

## Implementation Decisions

* Provider onboarding UI is extended in `src/components/settings/ProfileProviderConfig.tsx`. New provider type `cli-bridge` is added alongside `hosted`, `api`, `local`, `agent`, `terminal`. UI reuses existing provider tabs and status panels.
* Proxy implementation lives as an in-process Node service managed by the Electron main process. The service exposes an OpenAI-compatible HTTP endpoint on localhost, implementing `POST /v1/responses` and `POST /v1/chat/completions`. This matches the existing `codex-responses-api-proxy` pattern used by Open Interpreter.
* Authentication to CLI subscriptions is performed by reading the local CLI config directories. For Codex CLI Pro, the existing `~/.codex` config and auth token store is inspected. For Claude Code Pro, the `~/.claude` config and OAuth token store is inspected. No new user secrets are stored; the proxy inherits the CLI’s existing auth.
* The proxy registers as a custom `model_providers` entry via OIX config. Provider ID `builtin:cli-codex` and `builtin:cli-claude` are added. `wire_api` is `responses` for Codex and `chat` for Claude to match provider expectations.
* IPC surface is extended via `src/ipc.ts` provider methods: `listInterpreterProviders`, `listInterpreterModels`, `listInterpreterHarnesses`. No new IPC channels are required; proxy registration updates the provider list returned by OIX.
* Per-agent scope enforcement is preserved because the proxy is just another provider backend. All calls flow through `toolManager.callTool()` and `filesystemBoundary.ts` as existing providers do. Proxy does not bypass approval policy.
* Onboarding flow: detect CLI installation → read config → start proxy → validate with a ping request → register provider → show success. Errors surface in existing `StatusPanel` components.
* Seams for testing: 
  1. Provider UI seam at `ProfileProviderConfig` component, tested via Vitest.
  2. Proxy HTTP seam, tested via in-process HTTP client against the proxy server.
  3. IPC provider listing seam, tested via existing `providersIpc` mocks.
* No schema changes to core OIX home config. Custom provider entries are stored in the profile config under `profile.providerConfig`.

## Testing Decisions

* Tests target external behavior only: provider appears in UI, proxy responds to OpenAI-compatible requests, models are listed correctly.
* Unit tests for UI: existing `ProfileProviderConfig` tests are extended with `cli-bridge` tab cases, similar to existing `local` and `api` provider tests.
* Integration test for proxy: start proxy with mock CLI backend, send `POST /v1/responses`, assert status 200 and expected shape. Prior art: `server/tools` builtin tool tests.
* IPC tests: mock `providersIpc.listInterpreterProviders` to return `builtin:cli-codex` and `builtin:cli-claude`, verify UI renders.
* E2E seam: Playwright test for onboarding flow using a fake CLI binary stub, same pattern as `test:e2e:ci` for provider onboarding.

## Out of Scope

* Supporting CLI subscriptions beyond Codex CLI Pro and Claude Code Pro.
* Exposing CLI credentials to remote hosts; proxy is localhost only.
* Changing OIX runtime provider discovery protocol.
* Building a full code editor integration for the CLI; only model access is bridged.
* Handling subscription billing or license enforcement; that remains with the CLI vendors.

## Further Notes

* The proxy design mirrors Open Interpreter’s `codex-responses-api-proxy` which is already in `codex-rs/responses-api-proxy`. For Claude Code, community projects such as `claude-code-proxy`, `ccNexus`, `dario` provide reference implementations for OpenAI-compatible bridging.
* Security: keys never leave user machine. Proxy runs in-process, binds to 127.0.0.1 only, and respects existing per-agent file access policy.
* Future work could generalize the proxy to other CLI agents via a plugin interface, but this spec limits to Codex and Claude Code.
