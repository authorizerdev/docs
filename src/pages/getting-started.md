---
title: Getting Started
layout: ../layouts/Main.astro
---

## Trying out Authorizer

This guide helps you practice using Authorizer to evaluate it before you use it in a production environment. It includes instructions for installing the Authorizer server in standalone mode, creating accounts and realms for managing users and applications, and securing a WildFly server application.

## Installing a simple instance of Authorizer

Deploy Authorizer using [heroku](https://github.com/authorizerdev/authorizer-heroku) and quickly play with it in 30seconds
<br/><br/>
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku)

### Things to consider

- For social logins you will need respective social platform key and secret
- For having verified users you will need smtp server with email address using which system can send emails. System will send verify email link to email address and once verified then only user will be able to access it. _(Note: One can always disable the email verification to allow open sign up, which is not recommended for production as anyone can use anyone's email address 😅 )_
- For persisting user sessions you will need Redis URL. Else user session will be only persisted till the server is on / restarted, which is not recommended for production. For better performance and security it is recommended to deploy redis on the same infra as of your authorizer server.

## Integrating into your website

This example just demonstrates how you can use `@authorizerdev/authorizer-js` CDN version and have login wall ready in few seconds. You can also use the ES module version of `@authorizerdev/authorizer-js` or framework specific versions like `@authorizerdev/authorizer-react`

### Copy the following code in `html` file

> **Note:** Change AUTHORIZER_URL in below code with your authorizer url. Also you can change logout button component

```html
<script src="https://unpkg.com/@authorizerdev/authorizer-js/lib/authorizer.min.js"></script>

<script type="text/javascript">
	const authorizerRef = new Authorizer.Authorizer({
		authorizerURL: `AUTHORIZER_URL`,
		redirectURL: window.location.origin,
	});

	// use the button selector as per your application
	const logoutBtn = document.getElementById('logout');
	logoutBtn.addEventListener('click', async function () {
		await authorizerRef.logout();
		window.location.href = '/';
	});

	async function onLoad() {
		const res = await authorizerRef.fingertipLogin();
		if (res && res.user) {
			// you can use user information here, eg:
			/**
			const userSection = document.getElementById('user');
			const logoutSection = document.getElementById('logout-section');
			logoutSection.classList.toggle('hide');
			userSection.innerHTML = `Welcome, ${res.user.email}`;
			*/
		}
	}
	onLoad();
</script>
```
