# Project Architecture Rules

- Existing user login identifiers and company records must be snapshot-locked in database triggers; this prevents account takeover and accidental tenant mutation while allowing password recovery.
- Local agents and installers must receive backend endpoints at build or setup time; this keeps deployments portable across Supabase projects.
- Password recovery uses public same-origin routes and the Auth recovery session to update only the password; this preserves immutable identifiers and server-owned roles.
- Share the PontoMax logo and semantic theme tokens across authentication and signed-in layouts; this keeps brand updates consistent.
