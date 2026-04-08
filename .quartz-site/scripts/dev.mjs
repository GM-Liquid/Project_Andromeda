import chokidar from "chokidar"
import { spawn } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { getGearCatalogWatchPattern } from "./gear-catalog-source.mjs"
import { getQuartzDevCommand } from "./quartz-dev-command.mjs"
import { getRulebookWatchPattern } from "./rulebook-source.mjs"
import { syncBook } from "./sync-book.mjs"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const siteRoot = resolve(scriptDir, "..")
const repoRoot = resolve(siteRoot, "..")

const initialSync = await syncBook()
const sourceGlobs = [
  await getRulebookWatchPattern({ repoRoot }),
  await getGearCatalogWatchPattern({ repoRoot }),
  resolve(siteRoot, "data", "temporary", "concept-abilities.json"),
]

const { command, args } = getQuartzDevCommand({ siteRoot })
const quartz = spawn(command, args, {
  cwd: siteRoot,
  stdio: "inherit",
})

const watcher = chokidar.watch(sourceGlobs, {
  ignoreInitial: true,
})

watcher.on("all", async () => {
  const result = await syncBook()
  console.log(`Rulebook source changed. Synced Quartz content from ${result.sourceDir}.`)
})

console.log(`Watching rulebook sources: ${sourceGlobs.join(", ")}`)

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
