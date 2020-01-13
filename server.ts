import express = require('express')
import { join, resolve } from 'path'
import { watch, FSWatcher, readFileSync } from 'fs'
import { Application } from 'express'
import { safeLoad, FAILSAFE_SCHEMA } from 'js-yaml'
import { EOL } from 'os'

// Constants
const EVT_RENAME = 'rename'
const EVT_CHANGE = 'change'
const EVT_UPDATE = 'update'
const MSG_ERROR = 'invalid_file'

// Helper functions
const evtId = (_: any, id: number): string => `id: ${id}${EOL}`
const evtType = (_: any, type: string): string => `event: ${type}${EOL}`
const evtData = (_: any, data: string): string => `data: ${data}${EOL}`

// Application
function createWatcherServer(target: string): Application {
  const app = express()
  app.use(express.static(join(__dirname, 'client', 'build')))

  let watcher: FSWatcher | null = null

  // Events.
  app.get('/events', (_, res) => {
    let evtCounter: number = 0
    watcher = watch(target, (event, filename) => {
      evtCounter++
      // TODO: Add some debugging console.log(counter, event, filename)
      if (event === EVT_RENAME) {
        // TODO: Fill. Add also event for moving files.
        console.log(`New file name: ${filename}`)
      } else if (event === EVT_CHANGE) {
        // TODO: This should use the filename, not a workaround.
        const content = readFileSync(target, 'utf-8')

        res.write(evtId`${evtCounter}`)
        res.write(evtType`${EVT_UPDATE}`)
        try {
          const output = JSON.stringify(JSON.parse(content)).trim()
          res.write(evtData`${output}`)
        } catch {
          try {
            const output = JSON.stringify(
              safeLoad(content, { json: true, schema: FAILSAFE_SCHEMA })
            ).trim()
            res.write(evtData`${output}`)
          } catch {
            res.write(evtData`${MSG_ERROR}`)
          }
        }

        res.write(EOL)
      } else {
        console.log('weird flex but ok')
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
    } catch {
      try {
        safeLoad(content, { json: true, schema: FAILSAFE_SCHEMA })
      } catch {
        res.status(400).send({ error: true, message: MSG_ERROR })
      }
    }

    res.sendFile(filePath)
  })

  // Client side routing.
  app.get('/*', (_, res) => {
    res.sendFile(resolve(join(__dirname, 'client', 'build', 'index.html')))
  })

  const shutdown = () => {
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
createWatcherServer('./examples/swagger.json').listen(9000)
