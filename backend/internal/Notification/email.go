package notification

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"mime/multipart"
	"net"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"strconv"
	"strings"
	"time"
)

type EmailMessage struct{ To, Subject, TextBody, HTMLBody string }
type EmailSender interface {
	Send(context.Context, EmailMessage) error
}

type SMTPConfig struct {
	Host                     string
	Port                     int
	Username, Password, From string
	UseTLS                   bool
	Timeout                  time.Duration
}
type SMTPSender struct{ config SMTPConfig }

func NewSMTPSender(config SMTPConfig) *SMTPSender {
	if config.Timeout <= 0 {
		config.Timeout = 10 * time.Second
	}
	return &SMTPSender{config: config}
}

func (s *SMTPSender) Send(ctx context.Context, message EmailMessage) error {
	cfg := s.config
	to, err := mail.ParseAddress(message.To)
	if err != nil || to.Address != message.To {
		return fmt.Errorf("invalid recipient")
	}
	from, err := mail.ParseAddress(cfg.From)
	if err != nil || from.Address != cfg.From {
		return fmt.Errorf("invalid sender")
	}
	if strings.ContainsAny(message.Subject, "\r\n") || message.Subject == "" {
		return fmt.Errorf("invalid subject")
	}
	if cfg.Host == "" || cfg.Port < 1 || cfg.Port > 65535 {
		return fmt.Errorf("smtp is not configured")
	}

	dialer := net.Dialer{Timeout: cfg.Timeout}
	ctx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()
	conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)))
	if err != nil {
		return err
	}
	defer conn.Close()
	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	}
	if cfg.UseTLS && cfg.Port == 465 {
		tlsConn := tls.Client(conn, &tls.Config{ServerName: cfg.Host, MinVersion: tls.VersionTLS12})
		if err = tlsConn.HandshakeContext(ctx); err != nil {
			return err
		}
		conn = tlsConn
	}
	client, err := smtp.NewClient(conn, cfg.Host)
	if err != nil {
		return err
	}
	defer client.Close()
	if cfg.UseTLS && cfg.Port != 465 {
		if ok, _ := client.Extension("STARTTLS"); !ok {
			return fmt.Errorf("smtp server does not support required starttls")
		}
		if err = client.StartTLS(&tls.Config{ServerName: cfg.Host, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
	} else if !cfg.UseTLS && cfg.Username != "" {
		if ok, _ := client.Extension("STARTTLS"); !ok {
			return fmt.Errorf("smtp authentication requires tls")
		}
		if err = client.StartTLS(&tls.Config{ServerName: cfg.Host, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
	}
	if cfg.Username != "" {
		if ok, _ := client.Extension("AUTH"); !ok {
			return fmt.Errorf("smtp server does not support authentication")
		}
		if err = client.Auth(smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)); err != nil {
			return err
		}
	}
	if err = client.Mail(from.Address); err != nil {
		return err
	}
	if err = client.Rcpt(to.Address); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	if err = writeMessage(w, from, to, message); err != nil {
		_ = w.Close()
		return err
	}
	if err = w.Close(); err != nil {
		return err
	}
	return client.Quit()
}

func writeMessage(writer io.Writer, from, to *mail.Address, message EmailMessage) error {
	var body bytes.Buffer
	alt := multipart.NewWriter(&body)
	for _, part := range []struct{ contentType, content string }{
		{"text/plain; charset=UTF-8", message.TextBody}, {"text/html; charset=UTF-8", message.HTMLBody},
	} {
		header := textproto.MIMEHeader{}
		header.Set("Content-Type", part.contentType)
		header.Set("Content-Transfer-Encoding", "8bit")
		p, err := alt.CreatePart(header)
		if err != nil {
			return err
		}
		if _, err = io.WriteString(p, part.content); err != nil {
			return err
		}
	}
	if err := alt.Close(); err != nil {
		return err
	}
	_, err := fmt.Fprintf(writer, "From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=%q\r\n\r\n%s", from.String(), to.String(), message.Subject, alt.Boundary(), body.String())
	return err
}
