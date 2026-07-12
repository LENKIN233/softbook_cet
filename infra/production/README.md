# Production platform foundation

This directory owns the initial Tencent Cloud production boundary. The existing
`infra/cloudbase/functions/softbook-api` function remains the development and
staging `/v1` compatibility service; it is not a production datastore or auth
authority.

## Provisioning order

1. Create separate staging and production CloudBase Run environments, VPCs and
   subnets in Shanghai. Never share databases, buckets, secrets or service
   accounts between environments.
2. Copy the matching `terraform/*.tfvars.example` to an ignored local file,
   export `TF_VAR_postgresql_root_password`, then run `terraform init`,
   `terraform plan` and an approved `terraform apply`.
3. Create a least-privilege application database role and place its connection
   URL plus the variables from `services/api/.env.example` in CloudBase Run's
   encrypted environment configuration. Do not pass secrets through CLI
   `--envParams`. Keep Terraform state in an encrypted, access-controlled remote
   backend because provider state necessarily contains the database bootstrap
   password; never commit local state.
4. Build `services/api`, run its migration job once against the target database,
   and deploy with `deploy-cloudbase-run.sh`. The script uses `--override` so
   preconfigured secret variables are retained.
5. Verify `/health/ready`, SMS delivery, session rotation, deletion queue and a
   bootstrap request before shifting traffic.

The database has no public endpoint, deletion protection is enabled, private COS
content is versioned, and PostgreSQL base/log backup policies are managed by
Terraform. CloudBase Run is a stateless HTTP host; database migrations and
deletion workers must run as explicit jobs rather than background work inside an
autoscaled API process.

Current CloudBase Run documentation states that the product does not directly
support WAF attachment. Production edge protection therefore remains an open
release gate; do not claim WAF coverage until a supported API gateway or edge
topology has been verified.
