import React, { useState, useEffect } from 'react'
import { RedocStandalone } from 'redoc'

interface AppProps {
  apiEndpoint: string
  eventEndpoint: string
}

export default function App(props: AppProps): JSX.Element {
  const [api, setApi] = useState()

  useEffect(() => {
    fetch(props.apiEndpoint)
      .then(res => res.json())
      .then(json => setApi(json))
      .catch(err =>
        console.error(`Error processing the response: ${err.message}`)
      )

    const listener = (evt: any) => {
      try {
        const json = JSON.parse(evt.data)
        setApi(json)
      } catch (err) {
        console.error(`Invalid JSON received: ${err.message}`)
      }
    }

    const eventSource = new EventSource(props.eventEndpoint)
    eventSource.addEventListener('update', listener)
    return () => {
      eventSource.removeEventListener('update', listener)
    }
  }, [props.apiEndpoint, props.eventEndpoint])

  if (api) {
    return (
      <RedocStandalone
        spec={api}
        options={{
          nativeScrollbars: true,
          hideDownloadButton: true,
          menuToggle: true,
          requiredPropsFirst: true
        }}
      />
    )
  }

  return (
    <>
      <h1>Loading...</h1>
    </>
  )
}
