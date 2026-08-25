import { describe, expect, test } from "bun:test"
import type { Plugin } from "@opencode-ai/plugin"
import plugin from "../src/index"
import { registerTodoWrite } from "../tool"
import { formatTodos } from "../tool/format"
import type { Todo } from "../tool/schema"
import { loadTodos, saveTodos, todosKey } from "../tool/store"
import { validateTodos } from "../tool/validate"

/** Map-backed stand-in for the plugin-scoped KV storage. */
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

function mockContext(storage: MemoryStorage) {
  return { storage } as unknown as Plugin.Context
}

/** Minimal shape of the tool object passed to ctx.tool.transform's draft.add. */
type RegisteredTool = { name: string; options?: { codemode?: boolean; permission?: string } }

function makeToolContext(options: Record<string, unknown>, registered: RegisteredTool[]) {
  return {
    options,
    tool: {
      transform: async (callback: (draft: { add: (tool: RegisteredTool) => void }) => void) => {
        callback({ add: (tool) => registered.push(tool) })
        return { dispose: async () => {} }
      },
    },
    session: {
      hook: async () => ({ dispose: async () => {} }),
    },
  } as unknown as Plugin.Context
}

type TodoWriteMetadata = {
  todos: Todo[]
  total: number
  completed: number
  in_progress: number
  pending: number
  cancelled: number
}

describe("validateTodos", () => {
  test("accepts a valid input and returns the todos", () => {
    const input: Todo[] = [
      { content: "Write tests", status: "in_progress", priority: "high", activeForm: "writing" },
      { content: "Commit", status: "pending", priority: "low" },
    ]
    const result = validateTodos({ todos: input })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.todos).toEqual(input)
  })

  test("accepts an empty todos array", () => {
    const result = validateTodos({ todos: [] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.todos).toEqual([])
  })

  test("rejects input missing todos", () => {
    const result = validateTodos({})
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("todos")
  })

  test("rejects non-array todos", () => {
    const result = validateTodos({ todos: "nope" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("array")
  })

  test("rejects an item with a bad status", () => {
    const result = validateTodos({ todos: [{ content: "x", status: "bogus", priority: "high" }] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("status")
  })

  test("rejects an item with a bad priority", () => {
    const result = validateTodos({ todos: [{ content: "x", status: "pending", priority: "urgent" }] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("priority")
  })

  test("rejects an item missing content", () => {
    const result = validateTodos({ todos: [{ status: "pending", priority: "low" }] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("content")
  })

  test("rejects an item with empty content", () => {
    const result = validateTodos({ todos: [{ content: "   ", status: "pending", priority: "low" }] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("content")
  })

  test("rejects a non-object input", () => {
    const result = validateTodos(null)
    expect(result.ok).toBe(false)
  })
})

describe("formatTodos", () => {
  test("header shows completion counts", () => {
    const todos: Todo[] = [
      { content: "a", status: "completed", priority: "high" },
      { content: "b", status: "pending", priority: "low" },
      { content: "c", status: "pending", priority: "low" },
    ]
    expect(formatTodos(todos).split("\n")[0]).toBe("Todos 1/3 completed")
  })

  test("renders a distinct terminal-safe marker and priority per status", () => {
    const todos: Todo[] = [
      { content: "done", status: "completed", priority: "high" },
      { content: "doing", status: "in_progress", priority: "medium" },
      { content: "later", status: "pending", priority: "low" },
      { content: "skipped", status: "cancelled", priority: "high" },
    ]
    const text = formatTodos(todos)
    expect(text).toContain("[x] (high) done")
    expect(text).toContain("[>] (medium) doing")
    expect(text).toContain("[ ] (low) later")
    expect(text).toContain("[-] (high) skipped")
  })

  test("shows activeForm when present", () => {
    const text = formatTodos([
      { content: "task", status: "in_progress", priority: "high", activeForm: "writing tests" },
    ])
    expect(text).toContain("currently: writing tests")
  })

  test("omits the activeForm suffix when absent", () => {
    const text = formatTodos([{ content: "task", status: "pending", priority: "low" }])
    expect(text).not.toContain("currently:")
  })

  test("renders an empty list", () => {
    const text = formatTodos([])
    expect(text).toContain("Todos 0/0 completed")
    expect(text).toContain("(empty)")
  })
})

describe("persistence", () => {
  test("saveTodos then loadTodos round-trips the todos", async () => {
    const storage = new MemoryStorage()
    const ctx = mockContext(storage)
    const todos: Todo[] = [
      { content: "one", status: "pending", priority: "high" },
      { content: "two", status: "completed", priority: "low", activeForm: "reviewing" },
    ]
    await saveTodos(ctx, "sess-1", todos)
    expect(await storage.get(todosKey("sess-1"))).toEqual(todos)
    expect(await loadTodos(ctx, "sess-1")).toEqual(todos)
  })

  test("loadTodos returns an empty list for a missing key", async () => {
    const storage = new MemoryStorage()
    const ctx = mockContext(storage)
    expect(await loadTodos(ctx, "missing")).toEqual([])
  })

  test("loadTodos filters invalid stored items", async () => {
    const storage = new MemoryStorage()
    const ctx = mockContext(storage)
    await storage.set(todosKey("sess-3"), [
      { content: "ok", status: "pending", priority: "low" },
      { content: "", status: "pending", priority: "low" },
      "not-an-object",
    ])
    expect(await loadTodos(ctx, "sess-3")).toEqual([{ content: "ok", status: "pending", priority: "low" }])
  })
})

describe("todowrite execute", () => {
  test("stores valid input and returns formatted result with counts", async () => {
    const storage = new MemoryStorage()
    const ctx = mockContext(storage)
    const tool = registerTodoWrite(ctx)
    // The registered tool must be exposed as a native tool, not folded into the CodeMode catalog.
    expect(tool.options?.codemode).toBe(false)
    const inputTodos: Todo[] = [
      { content: "Write tests", status: "completed", priority: "high", activeForm: "writing" },
      { content: "Run tests", status: "in_progress", priority: "medium" },
      { content: "Commit", status: "pending", priority: "low" },
    ]
    const input = { todos: inputTodos }

    const result = await tool.execute(input, { sessionID: "sess-1" })

    expect(result.content).toContain("Todos 1/3 completed")
    const metadata = (result as { metadata: TodoWriteMetadata }).metadata
    expect(metadata.todos).toEqual(inputTodos)
    expect(metadata.total).toBe(3)
    expect(metadata.completed).toBe(1)
    expect(metadata.in_progress).toBe(1)
    expect(metadata.pending).toBe(1)
    expect(metadata.cancelled).toBe(0)
    expect(await storage.get(todosKey("sess-1"))).toEqual(inputTodos)
  })

  test("rejects invalid input with an error and does not store", async () => {
    const storage = new MemoryStorage()
    const ctx = mockContext(storage)
    const tool = registerTodoWrite(ctx)

    const result = await tool.execute(
      { todos: [{ content: "x", status: "bogus", priority: "high" }] },
      { sessionID: "sess-2" },
    )

    expect(result.content).toContain("Invalid todowrite input")
    expect(result.content).toContain("status")
    expect(await storage.get(todosKey("sess-2"))).toBeUndefined()
  })
})

describe("plugin registration", () => {
  test("registers todowrite when enabled or unset, and skips when disabled", async () => {
    const enabled: RegisteredTool[] = []
    const disabled: RegisteredTool[] = []
    const defaulted: RegisteredTool[] = []

    await plugin.setup(makeToolContext({ enabled: true }, enabled))
    await plugin.setup(makeToolContext({ enabled: false }, disabled))
    await plugin.setup(makeToolContext({}, defaulted))

    expect(enabled.map((t) => t.name)).toEqual(["todowrite"])
    expect(disabled.map((t) => t.name)).toEqual([])
    expect(defaulted.map((t) => t.name)).toEqual(["todowrite"])
    // The tool must stay in the native tool list, not sink into the CodeMode catalog.
    expect(enabled[0]?.options?.codemode).toBe(false)
    expect(defaulted[0]?.options?.codemode).toBe(false)
  })
})
