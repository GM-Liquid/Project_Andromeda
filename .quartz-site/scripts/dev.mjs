import chokidar from "chokidar"
import { spawn } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { syncBook } from "./sync-book.mjs"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const siteRoot = resolve(scriptDir, "..")
const repoRoot = resolve(siteRoot, "..")
const sourceGlob = resolve(repoRoot, "Книга правил v0.4", "*.md")

await syncBook()

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx"
const quartz = spawn(npxCommand, ["quartz", "build", "--serve"], {
  cwd: siteRoot,
  stdio: "inherit",
})

const watcher = chokidar.watch(sourceGlob, {
  ignoreInitial: true,
})

watcher.on("all", async () => {
  await syncBook()
  console.log("Rulebook source changed. Synced Quartz content pages.")
})

const shutdown = async (signal) => {
  await watcher.close()

  if (!quartz.killed) {
    quartz.kill(signal)
  }
}

process.on("SIGINT", async () => {
  await shutdown("SIGINT")
})

process.on("SIGTERM", async () => {
  await shutdown("SIGTERM")
})

quartz.on("exit", async (code) => {
  await watcher.close()
  process.exit(code ?? 0)
})
