// Package identity stores only verified identity, without a dependency on business modules.
package identity

import "github.com/gin-gonic/gin"

const key = "authenticated_actor"

type Actor struct {
	ID   string
	Role string
}

func Set(c *gin.Context, actor Actor) { c.Set(key, actor) }
func Get(c *gin.Context) (Actor, bool) {
	value, ok := c.Get(key)
	if !ok {
		return Actor{}, false
	}
	actor, ok := value.(Actor)
	return actor, ok
}
