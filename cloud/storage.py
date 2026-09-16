"""Cloudflare R2 (S3-compatible) storage for the users' durable video library.

Layout: users/<user_id>/<job_id>/<filename>. Presigned URLs give private,
time-limited view/download links — but only while R2_PUBLIC_BASE is unset; see
``presigned_get``, which hands back a permanent public URL when it is set.
Delete-by-prefix wipes a user's whole library when their subscription's grace
period ends.
"""
from urllib.parse import quote

import boto3
from botocore.config import Config

from .config import settings

_client = None


def client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
            config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
        )
    return _client


def user_prefix(user_id) -> str:
    return f"users/{user_id}/"


def job_key(user_id, job_id, filename) -> str:
    return f"users/{user_id}/{job_id}/{filename}"


def upload_file(local_path, key, content_type="video/mp4"):
    client().upload_file(local_path, settings.r2_bucket, key,
                         ExtraArgs={"ContentType": content_type})


def download_file(key, local_path):
    client().download_file(settings.r2_bucket, key, local_path)


def delete_key(key):
    client().delete_object(Bucket=settings.r2_bucket, Key=key)


def delete_keys(keys) -> int:
    """Delete an arbitrary list of keys, 1000 per call.

    ``delete_prefix`` has always batched; deleting a handful of named keys did
    not, so a free-tier sweep spent one R2 round-trip per clip.
    """
    keys = [k for k in keys if k]
    deleted = 0
    c = client()
    for i in range(0, len(keys), 1000):
        chunk = keys[i:i + 1000]
        c.delete_objects(Bucket=settings.r2_bucket,
                         Delete={"Objects": [{"Key": k} for k in chunk]})
        deleted += len(chunk)
    return deleted


def list_keys(prefix) -> list:
    """List every object key under a prefix."""
    c = client()
    keys = []
    token = None
    while True:
        kw = {"Bucket": settings.r2_bucket, "Prefix": prefix, "MaxKeys": 1000}
        if token:
            kw["ContinuationToken"] = token
        resp = c.list_objects_v2(**kw)
        keys.extend(o["Key"] for o in resp.get("Contents", []))
        if not resp.get("IsTruncated"):
            break
        token = resp.get("NextContinuationToken")
    return keys


def presigned_get(key, expires=3600, download_name=None) -> str:
    """A URL a client can GET. Signed against the S3 endpoint by default; a plain
    URL on the bucket's custom domain when R2_PUBLIC_BASE is set.

    Switching here rather than at each call site on purpose: every caller hands
    the result to a browser, and the S3 endpoint is the one variant browsers
    cannot reliably fetch (see settings.r2_public_base). The custom domain has no
    equivalent of ResponseContentDisposition, so a download keeps the object's
    own name, which is already the clip filename.

    The public-base branch returns a link that never expires and proves
    nothing, so ``expires`` is silently ignored and callers promising a
    "time-limited" link are wrong whenever it is set. Objects under that
    domain are public at the edge, so signing here would not help: closing it
    means a private bucket plus a Cloudflare Worker checking a token, not a
    change in this function.
    """
    base = settings.r2_public_base
    if base:
        return f"{base}/{quote(key, safe='/')}"
    params = {"Bucket": settings.r2_bucket, "Key": key}
    if download_name:
        params["ResponseContentDisposition"] = f'attachment; filename="{download_name}"'
    return client().generate_presigned_url("get_object", Params=params, ExpiresIn=expires)


def delete_prefix(prefix) -> int:
    """Delete every object under a prefix. Returns the count deleted."""
    c = client()
    deleted = 0
    token = None
    while True:
        kw = {"Bucket": settings.r2_bucket, "Prefix": prefix, "MaxKeys": 1000}
        if token:
            kw["ContinuationToken"] = token
        resp = c.list_objects_v2(**kw)
        objs = [{"Key": o["Key"]} for o in resp.get("Contents", [])]
        if objs:
            c.delete_objects(Bucket=settings.r2_bucket, Delete={"Objects": objs})
            deleted += len(objs)
        if not resp.get("IsTruncated"):
            break
        token = resp.get("NextContinuationToken")
    return deleted
