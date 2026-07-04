"""Shared atomic, lock-guarded JSON persistence for data/*.json read-modify-write stores.

Concurrent saves against a plain write_text() can interleave and clobber each other -- one
request's write can be partially overwritten by another's before either finishes. This module
guards the whole read-modify-write critical section with an flock on a per-store lockfile, and
writes via a temp file + os.replace so a reader never observes a partially-written file.
"""

import contextlib
import fcntl
import json
import os
from pathlib import Path
from typing import Any, Iterator
from uuid import uuid4


def atomic_write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f"{path.name}.tmp-{uuid4().hex}")
    tmp_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    os.replace(tmp_path, path)


@contextlib.contextmanager
def locked_store(path: Path) -> Iterator[None]:
    """Guards a read-modify-write critical section against a store with a per-file lock.

    Callers should perform both the read and the write inside this context, so a concurrent
    writer can't read stale data between another writer's read and write.
    """
    lock_path = path.with_name(f"{path.name}.lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with open(lock_path, "w") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)
