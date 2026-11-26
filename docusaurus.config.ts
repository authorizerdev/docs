import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const SITE_URL = 'https://docs.authorizer.dev';
/** Dimensions of themeConfig.image (img/authorizer-og.png), which Docusaurus emits per page as og:image */
const OG_IMAGE_WIDTH = '1734';
const OG_IMAGE_HEIGHT = '907';

const config: Config = {
  title: 'Authorizer',
  tagline: 'Open-source authentication and authorization solution for your applications',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: SITE_URL,
  baseUrl: '/',

  organizationName: 'authorizerdev',
  projectName: 'authorizer',

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  plugins: [
    [
      'docusaurus-plugin-llms',
      {
        // llms.txt (index) + llms-full.txt (all pages) + a .md copy of every
        // page, per llmstxt.org. Only the current (2.x) docs are included.
        docsDir: 'docs',
        title: 'Authorizer Documentation',
        description:
          'Authorizer is an open-source, self-hosted authentication and authorization server: OAuth2/OIDC, social login, MFA, passkeys, magic links, SAML/SCIM, OpenFGA fine-grained authorization, MCP server, and RFC 8693 agent delegation. Runs on 17 SQL, NoSQL and graph databases; configured entirely by CLI flags.',
        generateMarkdownFiles: true,
        excludeImports: true,
        removeDuplicateHeadings: true,
        includeOrder: [
          'introduction.md',
          'getting-started/**',
          'core/**',
          'enterprise/**',
          'sdks/**',
          'deployment/**',
          'integrations/**',
          'migration/**',
        ],
        includeUnmatchedLast: true,
      },
    ],
  ],

  headTags: [
    {
      tagName: 'meta',
      attributes: {
        name: 'keywords',
        content: 'authorizer, authentication, authorization, open-source, self-hosted, OAuth2, OpenID Connect, social login, magic link, GraphQL, SSO',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:type',
        content: 'website',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:image:width',
        content: OG_IMAGE_WIDTH,
      },
    },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:image:height',
        content: OG_IMAGE_HEIGHT,
      },
    },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:image:type',
        content: 'image/png',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:image:alt',
        content:
          'Authorizer — open-source authentication and authorization',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:site_name',
        content: 'Authorizer Documentation',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'twitter:image:alt',
        content:
          'Authorizer — open-source authentication and authorization',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'twitter:site:domain',
        content: 'docs.authorizer.dev',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'apple-mobile-web-app-title',
        content: 'Authorizer',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/img/apple-touch-icon.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/img/favicon-32x32.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/img/favicon-16x16.png',
      },
    },
  ],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/authorizerdev/docs/tree/main/',
          showLastUpdateTime: true,
          lastVersion: 'current',
          versions: {
            current: {
              label: '2.x (Latest)',
              badge: true,
            },
            '1.x': {
              label: '1.x',
              banner: 'unmaintained',
              // 1.x is unmaintained; keep it reachable for existing links but
              // out of search indexes so it stops competing with 2.x pages.
              noIndex: true,
            },
          },
        },
        blog: false,
        // Only register gtag when a real tracking ID is supplied.
        // The plugin loads the gtag script with whatever trackingID
        // it receives — passing a placeholder like 'G-XXXXXXXXXX'
        // causes the script load to fail (or be blocked locally by
        // ad-blockers) and then every page-view call throws
        // "window.gtag is not a function" at runtime.
        gtag: process.env.GOOGLE_ANALYTICS_ID
          ? {
              trackingID: process.env.GOOGLE_ANALYTICS_ID,
              anonymizeIP: true,
            }
          : undefined,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/authorizer-og.png',
    metadata: [
      {name: 'theme-color', content: '#3B82F6'},
      {name: 'msapplication-TileColor', content: '#ffffff'},
    ],
    colorMode: {
      respectPrefersColorScheme: true,
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
    navbar: {
      title: 'Authorizer',
      logo: {
        alt: 'Authorizer Logo',
        src: 'img/logo.png',
        srcDark: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'sdksSidebar',
          position: 'left',
          label: 'SDKs',
        },
        {
          type: 'docsVersionDropdown',
          position: 'right',
        },
        {
          href: 'https://authorizer.dev',
          label: 'Website',
          position: 'right',
        },
        {
          href: 'https://github.com/authorizerdev/authorizer',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/getting-started',
            },
            {
              label: 'Core',
              to: '/core',
            },
            {
              label: 'Deployment',
              to: '/deployment',
            },
          ],
        },
        {
          title: 'SDKs',
          items: [
            {
              label: 'JavaScript',
              to: '/sdks/authorizer-js',
            },
            {
              label: 'React',
              to: '/sdks/authorizer-react',
            },
            {
              label: 'Go',
              to: '/sdks/authorizer-go',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.gg/Zv2D5h6kkK',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/authorizerdev/authorizer',
            },
          ],
        },
      ],
      copyright: `Copyright \u00a9 ${new Date().getFullYear()} Authorizer. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['go', 'bash', 'graphql', 'yaml', 'toml', 'dart', 'python', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
