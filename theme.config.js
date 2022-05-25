export default {
  github: 'https://github.com/authorizerdev/docs/',
  docsRepositoryBase: 'https://github.com/authorizerdev/docs/blob/main',
  titleSuffix: ' – Authorizer',
  logo: (
    <>
      <img src="/images/logo.png" alt="logo" style={{ height: 35 }} />
      <span
        className="ml-2 mr-2 font-bold hidden md:inline"
        style={{
          fontSize: '1.5rem',
          letterSpacing: '0.1rem',
        }}
      >
        AUTHORIZER
      </span>
    </>
  ),
  head: (
    <>
      <meta name="msapplication-TileColor" content="#ffffff" />
      <meta name="theme-color" content="#ffffff" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta httpEquiv="Content-Language" content="en" />
      <meta
        name="description"
        content="Your Data Your Control. An Open Source Authentication and Authorization solution for your business. Easy to integrate and quick to implement with available SDKs"
      />
      <meta
        name="og:description"
        content="Your Data Your Control. An Open Source Authentication and Authorization solution for your business. Easy to integrate and quick to implement with available SDKs"
      />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content="/images/logo.png" />
      <meta name="twitter:site:domain" content="docs.authorizer.dev" />
      <meta name="twitter:url" content="https://docs.authorizer.dev" />
      <meta name="og:title" content="Authorizer Docs" />
      <meta name="og:image" content="/images/logo.png" />
      <meta name="apple-mobile-web-app-title" content="Authorizer" />
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/favicon_io/apple-touch-icon.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="192x192"
        href="/favicon_io/favicon-32x32.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="32x32"
        href="/favicon_io/favicon-32x32.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="96x96"
        href="/favicon_io/favicon-32x32.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="16x16"
        href="/favicon_io/favicon-16x16.png"
      />
      <link rel="icon" type="image/png" href="/favicon_io/favicon.ico" />
      <meta
        name="msapplication-TileImage"
        content="/favicon_io/favicon-16x16.png"
      />
    </>
  ),
  search: true,
  prevLinks: true,
  nextLinks: true,
  footer: true,
  footerEditLink: 'Edit this page on GitHub',
  footerText: <>{new Date().getFullYear()} © Authorizer.dev.</>,
  unstable_faviconGlyph: '👋',
}
