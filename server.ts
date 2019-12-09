import express = require('express')
import { join } from 'path'

interface watcherProps {
  port: number
  file: string
}

function watcher(props: watcherProps) {
  const app = express()

  app.use(express.static(join(__dirname, 'client', 'build')))
  app.get('/events', (req, res) => {
    // Infinite polling
    // req.socket.setTimeout(Infinity)

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    res.write('\n')
  })

  app.get('/api', (_, res) => {
    res.sendFile(join(__dirname, 'examples', 'swagger.json'))
  })

  app.get('/*', (_, res) => {
    res.sendFile(join(__dirname, 'client', 'build', 'index.html'))
  })

  app.listen(props.port)
}

watcher({
  port: 9000,
  file: './examples/swagger.json'
})
