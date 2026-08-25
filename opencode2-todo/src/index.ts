import { Plugin } from "@opencode-ai/plugin"
import { registerTodoWrite } from "../tool"
import { formatTodos } from "../tool/format"
import { loadTodos } from "../tool/store"

export default Plugin.define({
  id: "opencode2.todo",
  tui: true,
  async setup(ctx) {
    if (ctx.options.enabled === false) return
    // The TUI also imports this entry from the config "plugins" array, where a
    // server Context is not provided; only the ./tui export claims UI slots.
    if (!ctx.tool || !ctx.session) return
    await ctx.tool.transform((draft) => draft.add(registerTodoWrite(ctx)))
    if (ctx.options.injectEveryRound === false) return
    await ctx.session.hook("context", async (event) => {
      const todos = await loadTodos(ctx, event.sessionID)
      if (todos.length === 0) return
      event.system.push({ type: "text", text: formatTodos(todos) })
    })
  },
})
