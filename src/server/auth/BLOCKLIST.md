# Offline common-password blocklist

`common-passwords.txt.gz` is the Django project's bundled common-password list, downloaded on 2026-09-29 from https://raw.githubusercontent.com/django/django/main/django/contrib/auth/common-passwords.txt.gz. It is used locally, with no request or credential sent to an external service. The complete upstream BSD licence is preserved in DJANGO-LICENSE.txt. Replacing the list is a reviewed source change; preserve its licence and record its provenance.

Lookup is case-insensitive. Password hashing and login comparison preserve the exact entered characters; passwords are never trimmed or normalized before hashing.
