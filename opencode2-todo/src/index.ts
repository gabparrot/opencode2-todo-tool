import { Plugin } from "@opencode-ai/plugin"
import { registerTodoWrite } from "../tool"

export default Plugin.define({
  id: "opencode2.todo",
  tui: true,
  async setup(ctx) {
    if (ctx.options.enabled === false) return
    await ctx.tool.transform((draft) => draft.add(registerTodoWrite(ctx)))
  },
})
