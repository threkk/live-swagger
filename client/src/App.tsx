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
      .catch(_ => setApi(null))

    const listener = (evt: any) => {
      // TODO: This needs a try catch.
      const json = JSON.parse(evt.data)
      setApi(json)
    }

    const eventSource = new EventSource(props.eventEndpoint)
    eventSource.addEventListener('update', listener)
    return () => {
      eventSource.removeEventListener('update', listener)
    }
  }, [props.apiEndpoint, props.eventEndpoint])

  // TODO: Improve the error message.
  let output = <div>It is not a valid JSON</div>
  if (api) {
    output = (
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
  return output
}
