# Project Architecture Rules

- Existing user login identifiers and company records are snapshot-locked in database triggers; this prevents account takeover and accidental tenant mutation while allowing password recovery.