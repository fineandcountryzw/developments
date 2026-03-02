-- Create email_queue table for failed email retry
-- Run with: npx prisma db execute --file=./migrations/003_email_queue.sql

CREATE TABLE IF NOT EXISTS email_queue (
    id VARCHAR(255) PRIMARY KEY,
    to_address VARCHAR(500) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_content TEXT NOT NULL,
    from_address VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    retry_after TIMESTAMP WITH TIME ZONE,
    context VARCHAR(100),
    metadata JSONB,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, retry_after);
CREATE INDEX IF NOT EXISTS idx_email_queue_created ON email_queue(created_at);
