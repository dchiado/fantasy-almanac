"""Claude writeups stored in S3: power rankings and weekly recap summaries.

A writer lambda, invoked asynchronously, calls Claude and stores the text. Each
writeup gets at most one Claude call: a status marker is claimed with a
conditional write before the writer is invoked, and a failure is never retried.
See "Claude costs" in the README."""
import json
import os
from datetime import datetime, timedelta, timezone

import boto3
from botocore.exceptions import ClientError

from . import CACHE_BUCKET, s3

# Leagues that get Claude writeups, e.g. "166975,123". Cost guard: every new
# writeup is a Claude call.
AI_LEAGUES = {x.strip() for x in os.environ.get('AI_LEAGUES', '').split(',') if x.strip()}

# A pending writeup older than this is treated as failed (writers time out at
# 60s), so a writer that died silently isn't retried on every page load
PENDING_TIMEOUT = timedelta(minutes=5)


def ai_league(league_id):
    return str(league_id) in AI_LEAGUES


def invoke_async(function_name, payload):
    boto3.client('lambda').invoke(FunctionName=function_name, InvocationType='Event',
                                  Payload=json.dumps(payload))


def put_status(key, status, only_if_new=False):
    """Write a writeup's status marker. With only_if_new, the write fails with
    PreconditionFailed if a marker already exists, so only one request claims it."""
    extra = {'IfNoneMatch': '*'} if only_if_new else {}
    s3.put_object(Bucket=CACHE_BUCKET, Key=key, Body=json.dumps({'status': status}),
                  ContentType='application/json', **extra)


def writeup(text_key, status_key, allowed, start):
    """Return (text, status), starting the writer if the writeup is missing.

    status is "ready", "pending" (being written), "failed" or "disabled".

    Args:
        text_key: where the writer stores the text
        status_key: the writeup's status marker
        allowed: () -> bool, whether a new writeup may be started, e.g. the
            league is in AI_LEAGUES. Only called when there's nothing stored.
        start: () -> None, invokes the writer. Called at most once per status_key.
    """
    try:
        resp = s3.get_object(Bucket=CACHE_BUCKET, Key=text_key)
        return resp['Body'].read().decode('utf-8'), 'ready'
    except s3.exceptions.NoSuchKey:
        pass

    try:
        resp = s3.get_object(Bucket=CACHE_BUCKET, Key=status_key)
        status = json.loads(resp['Body'].read())['status']
        if status == 'pending' and datetime.now(timezone.utc) - resp['LastModified'] < PENDING_TIMEOUT:
            return None, 'pending'
        return None, 'failed'
    except s3.exceptions.NoSuchKey:
        pass

    if not allowed():
        return None, 'disabled'

    try:
        put_status(status_key, 'pending', only_if_new=True)
    except ClientError as e:
        if e.response['Error']['Code'] in ('PreconditionFailed', 'ConditionalRequestConflict'):
            return None, 'pending'  # another request claimed it first
        print(f"Couldn't claim writeup {status_key}: {e}")
        return None, 'failed'
    except Exception as e:
        # Fail closed: without a claimed marker, don't risk a Claude call
        print(f"Couldn't claim writeup {status_key}: {e}")
        return None, 'failed'

    try:
        start()
    except Exception as e:
        print(f"Couldn't invoke writer for {status_key}: {e}")
        put_status(status_key, 'failed')  # if this write fails too, the pending marker times out
        return None, 'failed'
    return None, 'pending'
