import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'introduction',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/index',
      ],
    },
    {
      type: 'category',
      label: 'Core',
      items: [
        'core/index',
        'core/server-config',
        'core/databases',
        'core/endpoints',
        'core/graphql-api',
        'core/oauth2-oidc',
        'core/email',
        'core/metrics-monitoring',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'deployment/index',
        'deployment/docker',
        'deployment/binary',
        'deployment/kubernetes',
        'deployment/helm-chart',
        'deployment/heroku',
        'deployment/railway',
        'deployment/render',
        'deployment/fly-io',
        'deployment/koyeb',
        'deployment/easypanel',
        'deployment/alibaba-cloud',
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: [
        'integrations/hasura',
        'integrations/react-native',
        'integrations/gatsbyjs',
      ],
    },
    {
      type: 'category',
      label: 'Migration',
      items: [
        'migration/v1-to-v2',
      ],
    },
    'contributing',
  ],
  sdksSidebar: [
    {
      type: 'category',
      label: 'authorizer-js',
      collapsed: false,
      items: [
        'sdks/authorizer-js/index',
        'sdks/authorizer-js/functions',
      ],
    },
    {
      type: 'category',
      label: 'authorizer-react',
      items: [
        'sdks/authorizer-react/index',
        'sdks/authorizer-react/components',
        'sdks/authorizer-react/hooks',
      ],
    },
    {
      type: 'category',
      label: 'authorizer-go',
      items: [
        'sdks/authorizer-go/index',
        'sdks/authorizer-go/example',
      ],
    },
    {
      type: 'category',
      label: 'authorizer-svelte',
      items: [
        'sdks/authorizer-svelte/index',
        'sdks/authorizer-svelte/components',
      ],
    },
    {
      type: 'category',
      label: 'authorizer-flutter',
      items: [
        'sdks/authorizer-flutter/index',
      ],
    },
    {
      type: 'category',
      label: 'authorizer-vue',
      items: [
        'sdks/authorizer-vue/index',
      ],
    },
  ],
};

export default sidebars;
