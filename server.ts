import express = require('express')
import { join, resolve, basename } from 'path'
import { watch, FSWatcher, readFileSync } from 'fs'
import { Application } from 'express'
import { safeLoad, FAILSAFE_SCHEMA } from 'js-yaml'
import { EOL } from 'os'
import { debug } from 'debug'
import {
  EVT_INVALID,
  EVT_UPDATE,
  EVT_CHANGE,
  EVT_CLOSE,
  DEBUG_NS,
  SIGTERM,
  SIGINT
} from './constants'

// Helper functions
const log = debug(DEBUG_NS)

const evtId = (_: any, id: number): string => `id: ${id}${EOL}`
const evtType = (_: any, type: string): string => `event: ${type}${EOL}`
const evtData = (_: any, data: string): string => `data: ${data}${EOL}`

// Application
export function createApp(target: string, withWatcher: boolean): Application {
  const app = express()
  const frontend = resolve(join(__dirname, 'client', 'build'))
  log(`Loading frontend from ${frontend}.`)
  app.use(express.static(frontend))

  // Events.
  if (withWatcher ?? false) {
    log('Watcher enabled.')
    const watcher: FSWatcher = watch(target, { encoding: 'utf-8' })
    const shutdown = () => {
      log('Shutting down...')
      if (watcher != null) {
        watcher.removeAllListeners()
        watcher.close()
      }
    }

    watcher.on(EVT_CLOSE, () => watcher.removeAllListeners())
    watcher.on(SIGTERM, shutdown)
    watcher.on(SIGINT, shutdown)

    app.get('/events', (_, res) => {
      let evtCounter: number = 0

      // Note: although the use the same keyword, they are different "change".
      watcher.addListener(EVT_CHANGE, (event: string, filename: string) => {
        if (event !== EVT_CHANGE) {
          // The other possible event is rename, whic is normally triggered when
          // a new file appears or disappers from a directory. Because we are
          // watching a file, this should never happen. We log it, but do nothing.
          log(`${event} on ${target} => no-op`)
        } else if (basename(target) !== filename) {
          // This should never happen because we are watching on a folder, so it
          // should always trigger on the file. However, the watcher
          // implementation is flaky, so to avoid errors we specifically do
          // nothing.
          log(`Event '${event}' on ${filename} => no-op`)
        } else {
          evtCounter++
          const content = readFileSync(target, 'utf-8')

          log(`Event '${event}' on ${target} => Sent to client.`)
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
        }
      })

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })

      res.write(EOL)
    })
  } else {
    app.get('/events', (_, res) => res.status(204).send())
  }

  // API.
  app.get('/api', (_, res) => {
    const content = readFileSync(target, 'utf-8')

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

    res.sendFile(target)
  })

  // Client side routing.
  app.get('/*', (req, res) => {
    log(`GET ${req.url} Resolving to client.`)
    res.sendFile(resolve(join(__dirname, 'client', 'build', 'index.html')))
  })

  return app
}
