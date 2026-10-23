package health

import "context"

type PingResult struct {
	Message     string `json:"message"`
	Service     string `json:"service"`
	Environment string `json:"environment"`
}

type Service struct {
	repository Repository
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) Ping(ctx context.Context) (PingResult, error) {
	info, err := s.repository.ApplicationInfo(ctx)
	if err != nil {
		return PingResult{}, err
	}
	return PingResult{
		Message:     "pong",
		Service:     info.Name,
		Environment: info.Environment,
	}, nil
}
