import assert from "node:assert/strict"
import { resolve } from "node:path"
import test from "node:test"

import { getQuartzDevCommand } from "./quartz-dev-command.mjs"

test("getQuartzDevCommand launches the local Quartz CLI with the current Node executable", () => {
  const siteRoot = resolve("D:/workspace/.quartz-site")
  const execPath = resolve("C:/Program Files/nodejs/node.exe")

  const command = getQuartzDevCommand({ siteRoot, execPath })

  assert.deepEqual(command, {
    command: execPath,
    args: [resolve(siteRoot, "quartz", "bootstrap-cli.mjs"), "build", "--serve"],
  })
})
