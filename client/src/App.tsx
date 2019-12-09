import React, { useState, useEffect, } from 'react';
import { RedocStandalone } from 'redoc';


interface AppProps {
  apiEndpoint: string,
  eventEndpoint: string
}

export default function App (props: AppProps): JSX.Element {
  const [api, setApi ] = useState()

  useEffect(() => {
    fetch(props.apiEndpoint).then(res => res.json()).then(json => setApi(json))
    const listener = (evt: any) => {
      const json = JSON.parse(evt.data)
      setApi(json)
    }

    const eventSource = new EventSource(props.eventEndpoint)
    eventSource.addEventListener('update', listener)
    return () => {
      eventSource.removeEventListener('update', listener)
    }
  }, [props.apiEndpoint, props.eventEndpoint])


    return api ? (<RedocStandalone spec={api} />) : <></>
}
