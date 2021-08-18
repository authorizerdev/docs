export const sidebar = [
	{
		text: 'Introduction',
		link: '', // No leading slash needed, so this links to the homepage
		children: [
			{ text: 'Getting Started', link: 'getting-started' },
			{ text: 'Contributing', link: 'contributing' },
		],
	},
	{
		text: 'Authorizer Core',
		link: 'core/', // No leading slash needed, so this links to the homepage
		children: [
			{ text: 'Environment Variables', link: 'getting-started' },
			{ text: 'Databases', link: 'databases' },
			{ text: 'GraphQL API', link: 'core/gql-api' },
			{ text: 'Session Management', link: 'contributing' },
		],
	},
	{
		text: 'Deployment Options',
		link: 'core/deployments/',
		children: [
			{ text: 'Heroku', link: 'heroku' },
			{ text: 'Docker', link: 'docker' },
			{ text: 'Kubernetes', link: 'kubernetes' },
			{ text: 'Binary', link: 'binary' },
			{ text: 'Authorizer Cloud', link: 'binary' },
		],
	},
	{
		text: 'Authorizer JS',
		link: 'core/deployments/',
		children: [
			{ text: 'Getting Started', link: 'getting-started' },
			{ text: 'Functions', link: 'functions' },
		],
	},
	{
		text: 'Authorizer React',
		link: 'core/deployments/',
		children: [
			{ text: 'Getting Started', link: 'getting-started' },
			{ text: 'Components', link: 'components' },
		],
	},
];
