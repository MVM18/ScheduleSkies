import Head from 'next/head'

// global styles must be imported only once in the custom App
import '../styles/globals.css'
import '../styles/navbar.css'
import '../styles/hero.css'
import '../styles/features.css'
import '../styles/plan.css'
import '../styles/dashboard.css'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="icon" href="/images/logo.png" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
