import React, { useState, useEffect } from 'react';
import { RedocStandalone } from 'redoc';


const API_ENDPOINT = 'api'
const EVENT_ENDPOINT = 'events'

export default function App () {
  const [api, setApi ] = useState({})

  const eventSource = new EventSource(EVENT_ENDPOINT)
  useEffect(() => {
    fetch(API_ENDPOINT).then(res => res.json()).then(json => setApi(json))
    const listener = evt => {
      const json = JSON.parse(evt.data)
      setApi(json)
    }

    eventSource.addEventListener('update', listener)
    return () => {
      eventSource.removeEventListener('update', listener)
    }
  }, [API_ENDPOINT, EVENT_ENDPOINT])

  return (<RedocStandalone
    spec={api}
    />)
}
