#!/usr/bin/env python3
"""Upload Daily Prior media to the worldos-media R2 bucket (media.claude.do).

Stdlib-only, matching build.py's no-deps convention. Uses the Cloudflare REST
objects endpoint with the bucket-scoped Bearer token — no SigV4, no boto:

    PUT https://api.cloudflare.com/client/v4/accounts/<acct>/r2/buckets/<bucket>/objects/<key>

Usage:
    upload_media.py <local-file> <r2-key>     # upload, print the public URL
    upload_media.py --check <r2-key>          # HEAD the public URL, report status + length

Key layout convention (documented in content/daily-prior/README.md):
    daily-prior/<episode-slug>/episode.mp3

Uploads are idempotent — PUT overwrites the object at the key. The body is
streamed from disk (urllib reads the file object), so episode-sized MP3s
don't get slurped into memory. One retry on a 5xx response.

Credentials come from ~/.secrets/worldos-media-r2.env (CF_R2_TOKEN,
R2_BUCKET, R2_PUBLIC_BASE) and ~/.secrets/cloudflare_account_id.
"""
import argparse
import pathlib
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request

ENV_FILE = pathlib.Path.home() / ".secrets" / "worldos-media-r2.env"
ACCOUNT_ID_FILE = pathlib.Path.home() / ".secrets" / "cloudflare_account_id"
API_BASE = "https://api.cloudflare.com/client/v4"

# Extension → Content-Type. Only the media types the Daily Prior feed actually
# ships; anything else falls back to application/octet-stream (still uploads —
# R2 serves it, browsers just won't inline it).
CONTENT_TYPES = {
    ".mp3": "audio/mpeg",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}
DEFAULT_CONTENT_TYPE = "application/octet-stream"


def content_type_for(filename):
    """Content-Type for a filename, by extension (case-insensitive)."""
    return CONTENT_TYPES.get(pathlib.Path(str(filename)).suffix.lower(),
                             DEFAULT_CONTENT_TYPE)


def episode_key(slug, filename="episode.mp3"):
    """Canonical R2 key for a Daily Prior episode asset:
    daily-prior/<episode-slug>/<filename>."""
    return f"daily-prior/{slug}/{filename}"


def normalize_key(key):
    """Validate + normalize a user-supplied key: no leading slash, no empty
    or dot-dot segments. Raises SystemExit on garbage rather than uploading
    to a surprising place."""
    key = str(key).lstrip("/")
    parts = key.split("/")
    if not key or any(p in ("", ".", "..") for p in parts):
        raise SystemExit(f"upload_media: bad r2 key {key!r} "
                         "(empty, '.', or '..' path segments are not allowed)")
    return key


def load_env(path=ENV_FILE):
    """Parse a KEY=VALUE env file (comments and blank lines ignored)."""
    env = {}
    try:
        text = pathlib.Path(path).read_text(encoding="utf-8")
    except OSError as e:
        raise SystemExit(f"upload_media: cannot read env file {path}: {e}")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()
    return env


def load_account_id(path=ACCOUNT_ID_FILE):
    try:
        return pathlib.Path(path).read_text(encoding="utf-8").strip()
    except OSError as e:
        raise SystemExit(f"upload_media: cannot read account id {path}: {e}")


def object_url(account_id, bucket, key):
    """REST endpoint URL for an object. The key is percent-encoded per
    segment ('/' kept as the separator)."""
    quoted = urllib.parse.quote(key, safe="/")
    return f"{API_BASE}/accounts/{account_id}/r2/buckets/{bucket}/objects/{quoted}"


def build_put_request(account_id, bucket, key, body, size, content_type, token):
    """The PUT request, factored out so tests can inspect it without any
    network. `body` may be a file object (streamed) or bytes."""
    req = urllib.request.Request(
        object_url(account_id, bucket, key), data=body, method="PUT")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", content_type)
    req.add_header("Content-Length", str(size))
    return req


def public_url(base, key):
    return f"{base.rstrip('/')}/{urllib.parse.quote(key, safe='/')}"


def force_ipv4():
    """This box's IPv6 is broken (routes blackhole) — filter getaddrinfo to
    A records so urllib never dangles on an AAAA connect."""
    orig = socket.getaddrinfo

    def ipv4_only(host, port, family=0, *args, **kwargs):
        return orig(host, port, socket.AF_INET, *args, **kwargs)

    socket.getaddrinfo = ipv4_only


def upload(local_file, key, opener=urllib.request.urlopen):
    """Upload local_file to key. Returns the public URL. One retry on 5xx."""
    env = load_env()
    account_id = load_account_id()
    token = env.get("CF_R2_TOKEN")
    bucket = env.get("R2_BUCKET")
    base = env.get("R2_PUBLIC_BASE")
    if not (token and bucket and base):
        raise SystemExit(f"upload_media: {ENV_FILE} is missing "
                         "CF_R2_TOKEN / R2_BUCKET / R2_PUBLIC_BASE")

    path = pathlib.Path(local_file)
    if not path.is_file():
        raise SystemExit(f"upload_media: no such file: {path}")
    size = path.stat().st_size
    ctype = content_type_for(path.name)

    last_err = None
    for attempt in (1, 2):
        with open(path, "rb") as body:
            req = build_put_request(account_id, bucket, key, body, size, ctype, token)
            try:
                with opener(req, timeout=120) as resp:
                    resp.read()
                break
            except urllib.error.HTTPError as e:
                detail = e.read().decode("utf-8", "replace")[:500]
                if e.code >= 500 and attempt == 1:
                    last_err = e
                    print(f"upload_media: got {e.code}, retrying once...",
                          file=sys.stderr)
                    continue
                raise SystemExit(
                    f"upload_media: PUT failed with {e.code}: {detail}")
    else:
        raise SystemExit(f"upload_media: PUT failed after retry: {last_err}")

    url = public_url(base, key)
    print(f"uploaded {path} ({size} bytes, {ctype})")
    print(url)
    return url


def check(key, opener=urllib.request.urlopen):
    """HEAD the public URL for key; report status + content-length.
    Exits nonzero when the object doesn't serve."""
    env = load_env()
    base = env.get("R2_PUBLIC_BASE")
    if not base:
        raise SystemExit(f"upload_media: {ENV_FILE} is missing R2_PUBLIC_BASE")
    url = public_url(base, key)
    # Cloudflare's bot filter 403s the default Python-urllib User-Agent on
    # the public host (verified 2026-08-19); a plain curl-ish UA passes.
    req = urllib.request.Request(url, method="HEAD",
                                 headers={"User-Agent": "upload-media-check/1.0"})
    try:
        with opener(req, timeout=60) as resp:
            print(f"{resp.status} {url}")
            print(f"content-length: {resp.headers.get('Content-Length', '?')}")
            print(f"content-type:   {resp.headers.get('Content-Type', '?')}")
            return resp.status
    except urllib.error.HTTPError as e:
        print(f"{e.code} {url}")
        raise SystemExit(1)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Upload media to the worldos-media R2 bucket "
                    "(or --check that a key serves publicly).")
    parser.add_argument("--check", metavar="R2_KEY",
                        help="HEAD the public URL for this key instead of uploading")
    parser.add_argument("args", nargs="*", metavar="LOCAL_FILE R2_KEY",
                        help="file to upload and its destination key")
    ns = parser.parse_args(argv)

    force_ipv4()
    if ns.check is not None:
        if ns.args:
            parser.error("--check takes only the key")
        check(normalize_key(ns.check))
        return
    if len(ns.args) != 2:
        parser.error("usage: upload_media.py <local-file> <r2-key>")
    upload(ns.args[0], normalize_key(ns.args[1]))


if __name__ == "__main__":
    main()
