import type { Plugin } from "@opencode-ai/plugin"
import { countTodos, formatTodos } from "./format"
import { parseTodo, inputSchema, outputSchema, type Todo } from "./schema"
import { saveTodos } from "./store"

export function registerTodoWrite(ctx: Plugin.Context) {
  return {
    name: "todowrite",
    description:
      "Manage a structured todo list for the current session. Replaces the full list each call. Use it to track progress during multi-step work and keep todo statuses current. Statuses: pending, in_progress (exactly one at a time), completed, cancelled. Priorities: high, medium, low.",
    input: inputSchema,
    output: outputSchema,
    options: { permission: "todowrite" },
    async execute(input: unknown, toolCtx: { sessionID: string }) {
      const todos = readTodos(input)
      if (!todos) {
        return {
          content:
            "todowrite requires a `todos` array of items with content, status, and priority. The session list was not changed.",
        }
      }
      await saveTodos(ctx, toolCtx.sessionID, todos)
      return {
        output: { todos },
        content: formatTodos(todos),
        metadata: { todos, ...countTodos(todos) },
      }
    },
  }
}

function readTodos(input: unknown): Todo[] | undefined {
  if (!input || typeof input !== "object" || !("todos" in input)) return
  if (!Array.isArray(input.todos)) return
  const todos = input.todos.flatMap((item) => {
    const todo = parseTodo(item)
    return todo ? [todo] : []
  })
  if (input.todos.length > 0 && todos.length === 0) return
  if (todos.length !== input.todos.length) return
  return todos
}
