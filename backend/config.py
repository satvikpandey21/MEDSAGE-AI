"""Explicit production CORS configuration; development defaults stay local."""
import os
from urllib.parse import urlsplit


def cors_origins():
    production = os.getenv('APP_ENV', 'development').lower() == 'production'
    raw = os.getenv('CORS_ALLOWED_ORIGINS')
    if raw is None:
        if production:
            raise ValueError('Set CORS_ALLOWED_ORIGINS for production.')
        raw = 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174'
    origins = list(dict.fromkeys(x.strip().rstrip('/') for x in raw.split(',') if x.strip()))
    if not origins:
        raise ValueError('At least one explicit frontend origin is required.')
    for origin in origins:
        url = urlsplit(origin)
        if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password or url.path or url.query or url.fragment:
            raise ValueError('CORS entries must be explicit HTTP(S) origins.')
        if production and (url.scheme != 'https' or url.hostname in ('localhost', '127.0.0.1', '::1')):
            raise ValueError('Production CORS origins must use public HTTPS.')
    return origins
