# Project Architecture Rules

- Existing user login identifiers and company records must be snapshot-locked in database triggers; this prevents account takeover and accidental tenant mutation while allowing password recovery.
- Local agents and installers must receive backend endpoints at build or setup time; this keeps deployments portable across Supabase projects.