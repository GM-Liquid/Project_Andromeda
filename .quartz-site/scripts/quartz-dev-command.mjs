import { resolve } from "node:path"

export function getQuartzDevCommand({
  siteRoot,
  execPath = process.execPath,
} = {}) {
  return {
    command: execPath,
    args: [resolve(siteRoot, "quartz", "bootstrap-cli.mjs"), "build", "--serve"],
  }
}
