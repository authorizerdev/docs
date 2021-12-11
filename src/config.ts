export const sidebar = [
  {
    text: "Introduction",
    link: "/", // No leading slash needed, so this links to the homepage
    children: [
      { text: "Getting Started", link: "/getting-started" },
      { text: "Contributing", link: "/contributing" },
    ],
  },
  {
    text: "Authorizer Core",
    link: "/core", // No leading slash needed, so this links to the homepage
    children: [
      { text: "Environment Variables", link: "/core/env" },
      { text: "Databases", link: "/core/databases" },
      { text: "Endpoints", link: "/core/endpoints" },
      { text: "GraphQL API", link: "/core/graphql-api" },
      // { text: 'Session Management', link: '/core/session-management' },
    ],
  },
  {
    text: "Deployment Options",
    link: "/deployment",
    children: [
      { text: "Heroku", link: "/deployment/heroku" },
      { text: "Railway.app", link: "/deployment/railway" },
      { text: "Kubernetes", link: "/deployment/kubernetes" },
      { text: "Binary", link: "/deployment/binary" },
      { text: "Authorizer Cloud", link: "/deployment/authorizer-cloud" },
    ],
  },
  {
    text: "Authorizer JS",
    link: "/authorizer-js/getting-started",
    children: [
      { text: "Getting Started", link: "/authorizer-js/getting-started" },
      { text: "Functions", link: "/authorizer-js/functions" },
    ],
  },
  {
    text: "Authorizer React",
    link: "/authorizer-react/getting-started",
    children: [
      { text: "Getting Started", link: "/authorizer-react/getting-started" },
      { text: "Components", link: "/authorizer-react/components" },
      { text: "Hooks", link: "/authorizer-react/hooks" },
    ],
  },
];
