# Runtime
brew "node"
brew "bun"

# Database tools
# postgresql@17 is keg-only: add its bin to PATH, or apps/cron's backup tests
# skip. The major version must match the server the backup job dumps from.
brew "postgresql@17"  # psql + pg_dump/pg_restore CLIs — DB runs in Docker

# Bucket backup, used by apps/cron. Without it the bucket backup tests skip.
brew "rclone"

# Container
cask "docker"

# Optional but recommended
brew "git"
