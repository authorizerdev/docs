---
sidebar_position: 2
title: Example
---

# How to use authorizer as API gateway

> Note: This example demonstrates how to use authorizer in middleware for a [go-gin](https://github.com/gin-gonic/gin) server. But logic remains the same under the hood, where you can get auth token from `header` and validate it via authorizer SDK

```go
package main

import (
	"net/http"
	"strings"

	"github.com/authorizerdev/authorizer-go"
	"github.com/gin-gonic/gin"
)

func AuthorizeMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		/**
		  for open routes you can add condition here and just return with c.Next()
		  so that it does not validate token for those routes
		*/

		authHeader := c.Request.Header.Get("Authorization")
		tokenSplit := strings.Split(authHeader, " ")

		defaultHeaders := map[string]string{}
		authorizerClient, err := authorizer.NewAuthorizerClient("YOUR_CLIENT_ID", "YOUR_AUHTORIZER_URL", "OPTIONAL_REDIRECT_URL", defaultHeaders)
		if err != nil {
			// unauthorized
			c.AbortWithStatusJSON(401, "unauthorized")
			return
		}

		if len(tokenSplit) < 2 || tokenSplit[1] == "" {
			// unauthorized
			c.AbortWithStatusJSON(401, "unauthorized")
			return
		}

		res, err := authorizerClient.ValidateJWTToken(&authorizer.ValidateJWTTokenInput{
			TokenType: authorizer.TokenTypeIDToken,
			Token:     tokenSplit[1],
		})
		if err != nil {
			// unauthorized
			c.AbortWithStatusJSON(401, "unauthorized")
			return
		}

		if !res.IsValid {
			// unauthorized
			c.AbortWithStatusJSON(401, "unauthorized")
			return
		}

		c.Next()
	}
}

func main() {
	router := gin.New()
	router.Use(AuthorizeMiddleware())

	router.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	router.Run(":8090")
}
```

**CURL command to test go-gin server created in example**

Copy JWT ID token from login response of authorizer `login` mutation / social media login and replace `JWT_TOKEN` below

```bash
curl --location --request GET 'http://localhost:8090/ping' \
--header 'Authorization: Bearer JWT_TOKEN'
```

## Object-level authorization with FGA

Once the token is validated, you can also ask Authorizer's embedded [OpenFGA](https://openfga.dev) engine whether the caller may act on a **specific object**. The middleware below forwards the caller's `Authorization` header — the server pins the subject from it — and fails closed on any error. See [Authorization (FGA)](/core/authorization) for the model and tuple setup.

```go
// RequirePermission gates a route on an FGA check, e.g.:
//   router.GET("/documents/:id", RequirePermission("can_view"), getDocument)
//   router.PUT("/documents/:id", RequirePermission("can_edit"), updateDocument)
func RequirePermission(relation string) gin.HandlerFunc {
	return func(c *gin.Context) {
		res, err := authorizerClient.CheckPermissions(&authorizer.CheckPermissionsRequest{
			Checks: []*authorizer.PermissionCheckInput{
				{Relation: relation, Object: "document:" + c.Param("id")},
			},
		}, map[string]string{
			// forward the caller's token so the server pins the subject
			"Authorization": c.Request.Header.Get("Authorization"),
		})
		if err != nil || len(res.Results) == 0 || !res.Results[0].Allowed {
			// fail closed
			c.AbortWithStatusJSON(403, "forbidden")
			return
		}
		c.Next()
	}
}
```

To render one page with several action flags (view / edit / delete buttons), batch the checks in one round trip — results come back in order and echo each pair:

```go
res, err := authorizerClient.CheckPermissions(&authorizer.CheckPermissionsRequest{
	Checks: []*authorizer.PermissionCheckInput{
		{Relation: "can_view", Object: "document:1"},
		{Relation: "can_edit", Object: "document:1"},
		{Relation: "can_delete", Object: "document:1"},
	},
}, map[string]string{"Authorization": authHeader})
if err != nil {
	// fail closed
}
for _, r := range res.Results {
	// r.Relation, r.Object, r.Allowed
}
```

And for list endpoints, ask once which objects the caller may see and filter your DB query by the result instead of checking one by one:

```go
res, err := authorizerClient.ListPermissions(&authorizer.ListPermissionsRequest{
	Relation:   "can_view",
	ObjectType: "document",
}, map[string]string{"Authorization": authHeader})
// res.Objects => ["document:1", "document:7", ...]
```
