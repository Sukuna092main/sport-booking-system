-- +goose Up
-- Preserve historical payment rows and enforce Stripe for all new attempts.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_provider_check;
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION enforce_stripe_payment_provider() RETURNS trigger AS $$
BEGIN
 IF NEW.provider <> 'stripe' THEN RAISE EXCEPTION 'Only stripe payments can be created'; END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd
CREATE TRIGGER payments_stripe_insert BEFORE INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION enforce_stripe_payment_provider();

-- +goose Down
DROP TRIGGER payments_stripe_insert ON payments;
DROP FUNCTION enforce_stripe_payment_provider();
-- Historical rows remain readable after rollback.
