"""
utils/helpers.py

Utility helpers for the application.

NOTE: The old `role_required` decorator that existed here was a leftover from
the PostgreSQL era. It had a broken signature — it injected `user_data` as the
first positional argument to the route function, which breaks Flask's URL
parameter routing (e.g. a route like `/<faculty_id>` would receive user_data
where it expected faculty_id). It was also a duplicate of `require_role` in
auth_middleware.py, which is the correct, actively-used version.

All route protection is now handled by:
  - require_auth     → backend/app/middleware/auth_middleware.py
  - require_role     → backend/app/middleware/auth_middleware.py

Do not add authentication decorators here.
"""