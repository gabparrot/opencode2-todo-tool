import { describe, expect, test } from "bun:test"
import type { Plugin } from "@opencode-ai/plugin"
import plugin from "../src/index"
import { formatTodos } from "../tool/format"
import type { Todo } from "../tool/schema"
import { saveTodos } from "../tool/store"

/** Map-backed stand-in for the plugin-scoped KV storage (mirrors todowrite.test.ts). */
class MemoryStorage {
  private readonly values = new Map<string, unknown>()

  async get(key: string): Promise<unknown> {
    return this.values.get(key)
  }

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, value)
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key)
  }

  async scan(): Promise<{ keys: string[] }> {
    return { keys: [...this.values.keys()] }
  }
}

/** Minimal stand-in for the mutable event the host delivers to the "context" hook. */
type ContextEvent = {
  sessionID: string
  system: Array<{ type: string; text: string }>
  messages: unknown[]
  tools: Record<string, unknown>
}

function emptyContextEvent(sessionID: string): ContextEvent {
  return { sessionID, system: [], messages: [], tools: {} }
}

type PluginHarness = {
  ctx: Plugin.Context
  storage: MemoryStorage
  registered: string[]
  contextCallback: () => ((event: ContextEvent) => Promise<void> | void) | undefined
}

/**
 * Builds a Plugin.Context stand-in that records tool registrations and captures
 * the "context" hook callback so tests can drive it with fake events.
 */
function makePluginContext(options: Record<string, unknown>, storage = new MemoryStorage()): PluginHarness {
  const registered: string[] = []
  let contextCallback: ((event: ContextEvent) => Promise<void> | void) | undefined
  const ctx = {
    options,
    storage,
    tool: {
      transform: async (callback: (draft: { add: (tool: { name: string }) => void }) => void) => {
        callback({ add: (tool) => registered.push(tool.name) })
        return { dispose: async () => {} }
      },
    },
    session: {
      hook: async (name: string, callback: (event: ContextEvent) => Promise<void> | void) => {
        if (name === "context") contextCallback = callback
        return { dispose: async () => {} }
      },
    },
  } as unknown as Plugin.Context
  return { ctx, storage, registered, contextCallback: () => contextCallback }
}

describe("context injection", () => {
  test("injects the current store snapshot and re-reads it fresh each round", async () => {
    const harness = makePluginContext({})
    await plugin.setup(harness.ctx)

    const sid = "sess-1"
    const todoA: Todo = { content: "First task", status: "pending", priority: "high" }
    await saveTodos(harness.ctx, sid, [todoA])

    const callback = harness.contextCallback()
    expect(callback).toBeDefined()
    if (!callback) return

    const firstEvent = emptyContextEvent(sid)
    await callback(firstEvent)
    expect(firstEvent.system).toHaveLength(1)
    expect(firstEvent.system[0]?.text).toBe(formatTodos([todoA]))
    expect(firstEvent.system[0]?.text).toContain("First task")

    // Update the store WITHOUT calling the todowrite tool, then hook again.
    const todoB: Todo = { content: "Second task", status: "completed", priority: "low" }
    await saveTodos(harness.ctx, sid, [todoB])

    const secondEvent = emptyContextEvent(sid)
    await callback(secondEvent)
    expect(secondEvent.system).toHaveLength(1)
    expect(secondEvent.system[0]?.text).toBe(formatTodos([todoB]))
    expect(secondEvent.system[0]?.text).toContain("Second task")
  })

  test("injects nothing when the store has no entry for the session", async () => {
    const harness = makePluginContext({})
    await plugin.setup(harness.ctx)

    const callback = harness.contextCallback()
    expect(callback).toBeDefined()
    if (!callback) return

    const event = emptyContextEvent("sess-empty")
    await callback(event)
    expect(event.system).toHaveLength(0)
    expect(event.system).toEqual([])
  })

  test("injects nothing when the store holds an explicit empty list", async () => {
    const harness = makePluginContext({})
    await plugin.setup(harness.ctx)

    const sid = "sess-empty-list"
    await saveTodos(harness.ctx, sid, [])

    const callback = harness.contextCallback()
    expect(callback).toBeDefined()
    if (!callback) return

    const event = emptyContextEvent(sid)
    await callback(event)
    expect(event.system).toHaveLength(0)
    expect(event.system).toEqual([])
  })

  test("registers the context hook by default alongside todowrite", async () => {
    const harness = makePluginContext({})
    await plugin.setup(harness.ctx)

    expect(harness.registered).toEqual(["todowrite"])
    expect(harness.contextCallback()).toBeDefined()
  })

  test("registers neither the tool nor the hook when enabled is false", async () => {
    const harness = makePluginContext({ enabled: false })
    await plugin.setup(harness.ctx)

    expect(harness.registered).toEqual([])
    expect(harness.contextCallback()).toBeUndefined()
  })

  test("registers the tool but not the hook when injectEveryRound is false", async () => {
    const harness = makePluginContext({ injectEveryRound: false })
    await plugin.setup(harness.ctx)

    expect(harness.registered).toEqual(["todowrite"])
    expect(harness.contextCallback()).toBeUndefined()
  })

  test("appends the snapshot without replacing existing system parts", async () => {
    const harness = makePluginContext({})
    await plugin.setup(harness.ctx)

    const sid = "sess-2"
    const todo: Todo = { content: "Task", status: "in_progress", priority: "medium", activeForm: "working" }
    await saveTodos(harness.ctx, sid, [todo])

    const callback = harness.contextCallback()
    expect(callback).toBeDefined()
    if (!callback) return

    const event = emptyContextEvent(sid)
    event.system.push({ type: "text", text: "existing" })
    await callback(event)

    expect(event.system).toHaveLength(2)
    expect(event.system[0]?.text).toBe("existing")
    expect(event.system[1]?.text).toBe(formatTodos([todo]))
  })
})