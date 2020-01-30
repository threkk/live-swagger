import { Command } from 'commander'
import { isAbsolute, resolve, join } from 'path'
import { existsSync, lstatSync } from 'fs'
import { AssertionError } from 'assert'
import { debug } from 'debug'
import { ERR_UNKN, DEBUG_NS, ERR_FILE } from './constants'
import { createApp } from './server'
import { createServer } from 'http'

const pkg = require('./package.json')

const log = debug(DEBUG_NS)
const intOption = (val: any, _: any): number => parseInt(val)

function fileOption(val: any, _: any): string {
  assertIsFilePath(val)
  const path = isAbsolute(val) ? val : resolve(join(process.cwd(), val))
  log(path)
  return path
}

function assertIsFilePath(val: any): asserts val is string {
  let path = val
  if (!isAbsolute(val)) {
    path = resolve(join(process.cwd(), val))
  }

  if (!existsSync(path)) {
    throw new AssertionError({ message: 'Value is not a valid path' })
  }

  const stats = lstatSync(path)
  if (!stats.isFile()) {
    throw new AssertionError({ message: 'Value is not a valid file' })
  }
}

process.on('uncaughtException', err => {
  console.error(ERR_UNKN)
  log(err.message)
})

const program = new Command()
program
  .version(pkg.version)
  .description(pkg.description)
  .option('-w, --watch', 'Enables watching the file.')
  .option('-d, --debug', 'Enables debug messages.')
  .option('-p, --port <port>', 'Port to execute live-swagger', intOption, 9000)
  .option('-f, --file <file>', 'Path to the input file.', fileOption)

try {
  program.parse(process.argv)
} catch (err) {
  console.error(ERR_FILE)
  process.exit(1)
}

if (program.debug) debug.enable(DEBUG_NS)

log(
  `Configuration: debug=${program.debug} file=${program.file} port=${program.port} watch=${program.watch}`
)

const app = createApp(program.file, program.watch)
createServer(app).listen(program.port, () =>
  console.log(`Launching on port ${program.port}...`)
)
