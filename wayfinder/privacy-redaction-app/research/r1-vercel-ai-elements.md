# R1 — Research: Vercel AI SDK + AI Elements (Conversational UI)

**Ticket:** `wayfinder/privacy-redaction-app/tickets/R1-research-vercel-ai-elements.md`
**Research Date:** 2026-09-06
**Sources:** Context7 (`/vercel/ai`, `/vercel/ai-elements`), Vercel AI Elements documentation at `https://elements.ai-sdk.dev/`

---

## 1. What is AI Elements — is it a separate package from `ai` core?

**Yes, AI Elements is a separate package** built on top of shadcn/ui that complements the Vercel AI SDK (`ai`).

- **AI Elements** (`@ai-elements/react`) is a React component library providing pre-built, customizable components for AI-native UIs. It is installed separately via `npx ai-elements@latest` and ships components like `Conversation`, `Message`, `PromptInput`, `Tool`, `Confirmation`, `Artifact`, `Panel`, `Canvas`, etc.
- **AI SDK** (`ai` / `@ai-sdk/react`) is the runtime/core library providing hooks (`useChat`, `useCompletion`, `useObject`), streaming primitives (`streamText`, `streamUI`, `createStreamableUI`), and provider interfaces.

AI Elements is designed to be **aligned with AI SDK types** — props match AI SDK types (e.g., `ToolUIPart`, `UIMessage`), and components handle complex streaming behaviors internally so the UI stays in sync with AI data streams. The AI SDK is a peer dependency (`ai@^6.0.105` for types and streaming utilities).

**Sources:**
- `/vercel/ai-elements` — "AI Elements is a component library and custom registry built on top of shadcn/ui to help you build AI-native applications faster."
- `/vercel/ai-elements` — "Props are designed to match AI SDK types, and hooks work seamlessly with existing patterns."
- `/vercel/ai-elements` — Required dependency: `ai@^6.0.105` (TypeScript types + streamdown streaming markdown renderer)

---

## 2. How do you build a streaming chat interface with it (components, hooks)?

The core pattern uses **`useChat` from `@ai-sdk/react`** combined with AI Elements components:

```tsx
"use client";
import { useChat } from "@ai-sdk/react";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputSubmit } from "@/components/ai-elements/prompt-input";

export default function ChatPage() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  return (
    <div className="h-screen flex flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent>
                {message.parts.map((part, i) =>
                  part.type === "text" ? (
                    <MessageResponse key={i}>{part.text}</MessageResponse>
                  ) : null
                )}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
      </Conversation>

      <PromptInputProvider>
        <PromptInput onSubmit={handleSubmit} className="p-4">
          <PromptInputBody>
            <PromptInputTextarea placeholder="Type a message..." />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </PromptInputProvider>
    </div>
  );
}
```

**Key components:**
- **`Conversation`** / **`ConversationContent`** — Scrollable message list container
- **`Message`** — Wrapper for a single message (user or assistant); `from="user|assistant"`
- **`MessageContent`** — Content area inside a message
- **`MessageResponse`** — Streaming text response (powered by `streamdown` markdown renderer)
- **`PromptInput`** — Multi-part input with header/body/footer slots
- **`PromptInputTextarea`** — Text input area
- **`PromptInputSubmit`** — Submit button with `status` prop (`ready|streaming|error`)
- **`usePromptInputAttachments`** — Hook for managing file attachments in the prompt input

**Scaffold command:**
```bash
npx create-next-app@latest ai-chatbot && cd ai-chatbot
npx ai-elements@latest
npm i ai @ai-sdk/react zod
npm i sonner  # for notifications
```

**Sources:**
- `/vercel/ai-elements` — "This component demonstrates a complete chat interface implementation"
- `/vercel/ai-elements` — "Build Conversational UI with Conversation and PromptInput"
- `/vercel/ai-elements` — "The integration flow for AI Elements follows a structured path: user types in PromptInput → useChat hook sends to API → AI SDK streams response → MessageResponse renders streaming text"

---

## 3. How do AI Elements drive UI state from LLM messages (tool calls, multipart messages)?

AI Elements uses the **AI SDK's `useChat` hook which exposes message parts** — each `message.parts` array contains typed parts (`text`, `tool-*`, `file`, etc.). Components switch on `part.type` to render appropriate UI.

### Tool Calls
AI Elements has dedicated **`Tool`** and **`Confirmation`** components for tool call rendering:

```tsx
// Tool component for displaying weather / data tool calls
{weatherTool && (
  <Tool defaultOpen={true}>
    <ToolHeader type="tool-fetch_weather_data" state={weatherTool.state} />
    <ToolContent>
      <ToolInput input={weatherTool.input} />
      <ToolOutput output={<MessageResponse>{formatWeatherResult(weatherTool.output)}</MessageResponse>} />
    </ToolContent>
  </Tool>
)}
```

Tool call states are accessed via `part.state` (from `ToolUIPart`):
- `input-streaming` — streaming input JSON
- `input-available` — complete input
- `approval-requested` — user confirmation needed
- `output-available` — tool result returned
- `output-error` — tool threw an error
- `output-denied` — user denied the tool

### Confirmation / Approval UI
```tsx
<Confirmation approval={deleteTool.approval} state={deleteTool.state}>
  <ConfirmationRequest>This tool wants to delete: {deleteTool.input?.filePath}</ConfirmationRequest>
  <ConfirmationActions>
    <ConfirmationAction onClick={() => addToolApprovalResponse({ id: approval.id, approved: true })}>Approve</ConfirmationAction>
    <ConfirmationAction onClick={() => addToolApprovalResponse({ id: approval.id, approved: false })}>Reject</ConfirmationAction>
  </ConfirmationActions>
</Confirmation>
```

### Multipart Message Rendering
Parts are rendered in a `switch` inside `MessageContent`:
```tsx
{message.parts.map((part, i) => {
  switch (part.type) {
    case "text":
      return <MessageResponse key={i}>{part.text}</MessageResponse>;
    case "tool-fetch_weather_data":
      return <ToolView key={i} tool={part} />; // render Tool component
    case "file":
      return <AttachmentView key={i} file={part} />;
    default:
      return null;
  }
})}
```

**Sources:**
- `/vercel/ai-elements` — "Frontend Chat UI with Tool Approval" example
- `/vercel/ai-elements` — "Weather App with AI SDK" showing `ToolUIPart` type
- `/vercel/ai` — Tool call streaming states (`input-streaming`, `output-available`, etc.)
- `/vercel/ai-elements` — Message parts rendering pattern from `conversation.tsx` example

---

## 4. Can an LLM message trigger a split-pane artifact view (50% chat / 50% file panel)?

**Yes, but not natively via AI Elements alone** — the split-pane layout is achieved through **parent layout composition**. AI Elements provides the components; the layout is custom CSS/React.

The **IDE example** (`https://elements.ai-sdk.dev/examples/ide`) shows a three-panel layout:
> "Building an AI-powered IDE involves creating a sophisticated three-panel layout: file tree on the left, central area for code/terminal, and a dedicated right-hand panel for the AI chat interface."

For a **50/50 split-pane** (chat + artifact/file panel), you would:
1. Use a flex/grid layout parent
2. Render `<Conversation>` in the left pane
3. Render an `<Artifact>` or custom panel in the right pane
4. Orchestrate visibility based on message parts or tool results

AI Elements **does not have a built-in split-pane component**. The `Panel` component exists (added via `npx ai-elements@latest add panel`) but is a collapsible side panel (drawer-style), not a 50/50 splitter.

The **Canvas** component (ReactFlow-based) is available for workflow/node visualization, but it's not a generic split-pane.

**For a chat-then-artifact-panel flow**, you'd likely:
1. Detect a specific message part or tool result (e.g., `tool-generate-file`)
2. Conditionally render a side-by-side layout
3. Populate the right panel with `<Artifact>` + content components (`CodeBlock`, `FileTree`, `Terminal`, etc.)

**Sources:**
- `/vercel/ai-elements` — IDE example docs: "three-panel layout: file tree left, central code/terminal, right-hand AI chat"
- `/vercel/ai-elements` — Canvas component wraps ReactFlow for node-based layouts
- `/vercel/ai-elements` — Panel component: `npx ai-elements@latest add panel` (collapsible drawer)

---

## 5. How does the `@ai-sdk/ui-components` or similar package structure work?

**There is no `@ai-sdk/ui-components` package** in current versions. The AI SDK's UI layer is:

| Package | Role |
|---|---|
| `ai` | Core runtime: `streamText`, `createUIMessageStreamResponse`, type definitions (`UIMessage`, `ToolUIPart`, etc.) |
| `@ai-sdk/react` | React hooks: `useChat`, `useCompletion`, `useObject` |
| `@ai-sdk/rsc` | Server Components: `streamUI`, `createStreamableUI` for generative UI |
| `@ai-elements/react` | Separate shadcn/ui-based component library (not Vercel-maintained) |

AI Elements components are **individually importable** from the installed registry:
```tsx
import { Conversation } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Tool, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
```

Components can be added individually:
```bash
npx ai-elements@latest add message
npx ai-elements@latest add tool
npx ai-elements@latest add panel
# or via shadcn:
npx shadcn@latest add @ai-elements/message
```

AI Elements uses composable compound-component patterns:
```tsx
// Good (composable)
<Message from="assistant">
  <MessageContent>
    <MessageResponse>{text}</MessageResponse>
  </MessageContent>
  <MessageActions>
    <MessageAction label="Copy" onClick={handleCopy}><CopyIcon /></MessageAction>
  </MessageActions>
</Message>
```

**Runtime dependencies** (from `packages/elements/package.json`):
- `ai@^6.0.105` — types only (`ToolUIPart`, `UIMessage`), no `useChat` runtime dep
- `streamdown@^2.4.0` — streaming markdown renderer powering `MessageResponse`
- `@xyflow/react` — for `Canvas` component (node/graph views)
- `@repo/shadcn-ui` — internal shadcn/ui registry

**Sources:**
- `/vercel/ai-elements` — "Install AI Elements via CLI" + "add component" commands
- `/vercel/ai-elements` — Package.json runtime deps showing `ai` is types-only
- `/vercel/ai-elements` — Composable component pattern example from Philosophy docs
- `/vercel/ai-elements` — Implementation guide for composable vs monolithic component patterns

---

## 6. What is the recommended pattern for a chat-then-artifact-panel conversational flow?

The recommended pattern uses **conditional layout based on message parts**:

### Pattern: Message Part → Conditional Panel

```tsx
"use client";
import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, type PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { Artifact, ArtifactHeader, ArtifactContent, ArtifactActions } from "@/components/ai-elements/artifact";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { FileTree } from "@/components/ai-elements/file-tree";

export default function ChatWithArtifact() {
  const { messages, sendMessage } = useChat({ transport: new DefaultChatTransport({ api: "/api/chat" }) });
  
  // Track if we should show artifact panel
  const [artifactData, setArtifactData] = useState<{
    title?: string;
    content?: React.ReactNode;
  } | null>(null);

  // Find the latest message with an artifact trigger
  const latestMessage = messages[messages.length - 1];
  const artifactPart = latestMessage?.parts?.find(
    (part) => part.type === "tool-generate-files" || part.type === "text"
  );

  const handleSubmit = (message: PromptInputMessage) => {
    sendMessage({ text: message.text });
  };

  return (
    <div className="h-screen flex">
      {/* Left: Chat pane */}
      <div className={`flex flex-col ${artifactData ? "w-1/2" : "w-full"}`}>
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return <MessageResponse key={i}>{part.text}</MessageResponse>;
                    }
                    if (part.type === "tool-generate-files") {
                      // When files are generated, show artifact panel
                      setArtifactData({ title: "Generated Files", content: <FileTree files={part.output?.files} /> });
                      return null;
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))}
          </ConversationContent>
        </Conversation>
        <PromptInput onSubmit={handleSubmit} />
      </div>

      {/* Right: Artifact panel */}
      {artifactData && (
        <div className="w-1/2 border-l">
          <Artifact>
            <ArtifactHeader>
              <ArtifactTitle>{artifactData.title}</ArtifactTitle>
            </ArtifactHeader>
            <ArtifactContent>
              {artifactData.content}
            </ArtifactContent>
            <ArtifactActions>
              <ArtifactAction label="Copy"><CopyIcon /></ArtifactAction>
              <ArtifactClose onClick={() => setArtifactData(null)} />
            </ArtifactActions>
          </Artifact>
        </div>
      )}
    </div>
  );
}
```

### Key patterns:
1. **`useChat` manages message state** — the `messages` array with typed `parts` is the source of truth
2. **Scan `message.parts`** after each update to detect artifact-triggering parts (e.g., `tool-generate-files`, specific tool names)
3. **Lift state to parent** — store `artifactData` in local state; when set, switch layout to 50/50
4. **Use `Artifact` component** — structured container with header, content, and actions slots
5. **Populate right pane** with specialized components: `CodeBlock`, `FileTree`, `Terminal`, `WebPreview`, `Sandbox`, etc.

### Relevant AI Elements components for the right pane:
- `Artifact` + `ArtifactHeader` / `ArtifactContent` / `ArtifactActions`
- `CodeBlock` — syntax highlighted code
- `FileTree` — hierarchical file display
- `Terminal` — streaming terminal output
- `WebPreview` — iframe-based URL preview
- `Sandbox` — isolated execution environment
- `Canvas` — ReactFlow-based node/graph canvas

**Sources:**
- `/vercel/ai-elements` — Artifact component API and compound structure
- `/vercel/ai-elements` — IDE example: three-panel layout pattern
- `/vercel/ai` — `streamUI` / `createStreamableUI` for server-driven generative UI
- `/vercel/ai-elements` — Message parts switch pattern for conditional rendering

---

## Summary

| Q | Answer |
|---|---|
| **1. AI Elements vs `ai` core** | Separate package (`@ai-elements/react`); shadcn/ui-based React component library; `ai` is a peer dependency for types and streaming primitives |
| **2. Streaming chat interface** | `useChat` from `@ai-sdk/react` + AI Elements components: `Conversation`, `Message`, `PromptInput`, `MessageResponse` |
| **3. UI state from LLM messages** | `message.parts[]` typed array; switch on `part.type` to render `MessageResponse` (text), `Tool` (tool calls), `Confirmation` (approvals), attachments |
| **4. Split-pane artifact view** | Not native to AI Elements; achieved by conditional parent layout (flex 50/50) driven by message part detection; `Panel` is a collapsible drawer, not a 50/50 splitter |
| **5. Package structure** | No `@ai-sdk/ui-components`; UI hooks in `@ai-sdk/react`; AI Elements components in `@/components/ai-elements/*` from local shadcn registry; add per-component via `npx ai-elements@latest add <component>` |
| **6. Chat-then-artifact flow** | `useChat` → scan `message.parts` for artifact triggers → lift `artifactData` state → conditionally render 50/50 flex layout with `Artifact` + content components in right pane |
