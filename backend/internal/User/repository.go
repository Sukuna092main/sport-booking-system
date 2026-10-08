package user

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

var ErrNotFound = errors.New("user not found")
var ErrEmailTaken = errors.New("email taken")

type Repository interface {
	Create(context.Context, string, string, string, *string) (User, error)
	ByEmail(context.Context, string) (User, error)
	ByID(context.Context, string) (User, error)
}

type SQLRepository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *SQLRepository { return &SQLRepository{db: db} }

const columns = "id::text, email::text, password_hash, full_name, phone, role, status, created_at, updated_at"

type scanner interface{ Scan(...any) error }

func scanUser(row scanner) (User, error) {
	var u User
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Phone, &u.Role, &u.Status, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	u.CreatedAt = u.CreatedAt.UTC()
	u.UpdatedAt = u.UpdatedAt.UTC()
	return u, err
}

func (r *SQLRepository) Create(ctx context.Context, email, hash, fullName string, phone *string) (User, error) {
	u, err := scanUser(r.db.QueryRowContext(ctx, `INSERT INTO users (email,password_hash,full_name,phone,role,status) VALUES ($1,$2,$3,$4,'USER','ACTIVE') RETURNING `+columns, email, hash, fullName, phone))
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" && pg.ConstraintName == "users_email_uk" {
		return User{}, ErrEmailTaken
	}
	return u, err
}

func (r *SQLRepository) ByEmail(ctx context.Context, email string) (User, error) {
	return scanUser(r.db.QueryRowContext(ctx, "SELECT "+columns+" FROM users WHERE email=$1", email))
}

func (r *SQLRepository) ByID(ctx context.Context, id string) (User, error) {
	return scanUser(r.db.QueryRowContext(ctx, "SELECT "+columns+" FROM users WHERE id=$1", id))
}
