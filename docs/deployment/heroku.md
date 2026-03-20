---
sidebar_position: 5
title: Heroku
---

# Deploy on Heroku

## Create Instance

Deploy Authorizer with PostgreSQL on [Heroku](https://heroku.com):

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/authorizerdev/authorizer-heroku)

After clicking the button:

### Step 1: Enter the App name

The app name becomes your URL. For example, `authorizer-demo` gives you `authorizer-demo.herokuapp.com`.

### Step 2: Choose the Region and deploy

Select your deployment region (United States or Europe).

### Step 3: Configure for v2

For Authorizer v2, configure the following required variables in your Heroku app settings under **Config Vars**:

| Variable | Example Value |
| -------- | ------------- |
| `DATABASE_TYPE` | `postgres` |
| `DATABASE_URL` | *(auto-configured by Heroku add-on)* |
| `JWT_TYPE` | `HS256` |
| `JWT_SECRET` | `test` |
| `ADMIN_SECRET` | `admin` |
| `CLIENT_ID` | `123456` |
| `CLIENT_SECRET` | `secret` |

Update the Procfile or startup command to pass CLI flags:

```
web: ./build/server --database-type=$DATABASE_TYPE --database-url=$DATABASE_URL --jwt-type=$JWT_TYPE --jwt-secret=$JWT_SECRET --admin-secret=$ADMIN_SECRET --client-id=$CLIENT_ID --client-secret=$CLIENT_SECRET
```

---

## Updating Instance

### Prerequisites

- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
- [Git](https://git-scm.com/downloads)

### Step 1: Clone Authorizer Heroku App

```bash
git clone https://github.com/authorizerdev/authorizer-heroku
cd authorizer-heroku
```

### Step 2: Attach Heroku app

```bash
# Replace authorizer-heroku with your Heroku app's name
heroku git:remote -a authorizer-heroku
heroku stack:set container -a authorizer-heroku
```

### Step 3: Deploy the latest version

```bash
git push heroku main
```
