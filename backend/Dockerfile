# ---- Stage build ----
FROM golang:1.25-alpine AS build
WORKDIR /app

# Copy go.mod/go.sum trước để cache layer download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy toàn bộ source rồi build binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/api

# ---- Stage runtime (image nhỏ, chỉ chứa binary) ----
FROM alpine:3.21
RUN apk add --no-cache tzdata
RUN adduser -D appuser
USER appuser
WORKDIR /app
COPY --from=build /out/server /app/server
EXPOSE 8080
CMD ["/app/server"]
