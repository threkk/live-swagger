import express = require('express')
import { join, resolve } from 'path'
import { watch, FSWatcher, readFileSync } from 'fs'
import { Application } from 'express'
import { safeLoad, FAILSAFE_SCHEMA } from 'js-yaml'
import { EOL } from 'os'
import { debug } from 'debug'

// Constants
const EVT_RENAME = 'rename'
const EVT_CHANGE = 'change'
const EVT_UPDATE = 'update'
const EVT_INVALID = 'invalid_file'

// Helper functions
const log = debug('live-swagger')

const evtId = (_: any, id: number): string => `id: ${id}${EOL}`
const evtType = (_: any, type: string): string => `event: ${type}${EOL}`
const evtData = (_: any, data: string): string => `data: ${data}${EOL}`

// Application
function createWatcherServer(target: string): Application {
  const app = express()
  const frontend = join(__dirname, 'client', 'build')
  log(`Loading frontend from ${frontend}.`)
  app.use(express.static(frontend))

  let watcher: FSWatcher | null = null

  // Events.
  app.get('/events', (_, res) => {
    let evtCounter: number = 0
    watcher = watch(target, (event, filename) => {
      evtCounter++
      log(
        `Watcher triggered - counter:${evtCounter}, event:${event}, filename:${filename}`
      )

      if (event === EVT_RENAME) {
        log(`New file name: ${filename}`)
        // TODO: Fill. Add also event for moving files.
      } else if (event === EVT_CHANGE) {
        // TODO: This should use the filename, not a workaround.
        const content = readFileSync(target, 'utf-8')

        log('Change event detected, sending new version to client.')
        res.write(evtId`${evtCounter}`)
        res.write(evtType`${EVT_UPDATE}`)
        try {
          const output = JSON.stringify(JSON.parse(content)).trim()
          log('Detected JSON format.')
          res.write(evtData`${output}`)
        } catch {
          try {
            const output = JSON.stringify(
              safeLoad(content, { json: true, schema: FAILSAFE_SCHEMA })
            ).trim()
            log('Detected YAML format.')
            res.write(evtData`${output}`)
          } catch {
            log('Invalid format detected.')
            res.write(evtData`${EVT_INVALID}`)
          }
        }

        res.write(EOL)
      } else {
        log('Other type of event detected. Reload not triggered.')
      }
    })

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })

    res.write(EOL)
  })

  // API.
  app.get('/api', (_, res) => {
    const filePath = resolve(join(__dirname, target))
    const content = readFileSync(filePath, 'utf-8')

    try {
      JSON.parse(content.trim())
      log('JSON format detected.')
    } catch {
      try {
        safeLoad(content, { json: true, schema: FAILSAFE_SCHEMA })
        log('YAML format detected.')
      } catch {
        log('Invalid file format detected.')
        res.status(400).send({ error: true, message: EVT_INVALID })
      }
    }

    res.sendFile(filePath)
  })

  // Client side routing.
  app.get('/*', (req, res) => {
    log(`GET ${req.url} Resolving to client.`)
    res.sendFile(resolve(join(__dirname, 'client', 'build', 'index.html')))
  })

  const shutdown = () => {
    log('Shutting down...')
    if (watcher != null) {
      watcher.close()
    }
  }

  // TODO: on ENOENT, ECONNREF
  app.on('SIGTERM', shutdown)
  app.on('SIGINT', shutdown)

  return app
}

// TODO: This should go in a CLI.
log('Running on port 9000')
createWatcherServer('./examples/swagger.json').listen(9000)
