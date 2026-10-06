package health

import "context"

type ApplicationInfo struct {
	Name        string
	Environment string
}

// Repository is the source for application metadata returned by the scaffold ping.
// Persistence-backed repositories belong to their domain modules and reviewed DB task.
type Repository interface {
	ApplicationInfo(context.Context) (ApplicationInfo, error)
}

type configRepository struct {
	info ApplicationInfo
}

func NewConfigRepository(appName, environment string) Repository {
	return configRepository{info: ApplicationInfo{Name: appName, Environment: environment}}
}

func (r configRepository) ApplicationInfo(ctx context.Context) (ApplicationInfo, error) {
	if err := ctx.Err(); err != nil {
		return ApplicationInfo{}, err
	}
	return r.info, nil
}
