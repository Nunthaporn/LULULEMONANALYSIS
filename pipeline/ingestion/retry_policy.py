from __future__ import annotations

import random
import re
import time
from dataclasses import dataclass
from typing import Callable

import requests

from pipeline.config import get_config


SENSITIVE_PATTERNS = (
    re.compile(r"(?i)(authorization\s*[:=]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(cookie\s*[:=]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(token\s*[:=]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(password\s*[:=]\s*)([^\s,;]+)"),
    re.compile(r"(?i)(mongodb(\+srv)?://)([^@\s]+)@"),
)


class RetryableSourceError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        error_type: str,
        status_code: int | None = None,
        retry_after_seconds: float | None = None,
    ) -> None:
        super().__init__(message)
        self.error_type = error_type
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds


class NonRetryableSourceError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        error_type: str,
        status_code: int | None = None,
        diagnostic_sample: str | None = None,
    ) -> None:
        super().__init__(message)
        self.error_type = error_type
        self.status_code = status_code
        self.diagnostic_sample = diagnostic_sample


class SourceAccessBlockedError(NonRetryableSourceError):
    pass


class SourceAuthenticationError(NonRetryableSourceError):
    pass


def redact_sensitive_text(message: str) -> str:
    redacted = message
    for pattern in SENSITIVE_PATTERNS:
        if "mongodb" in pattern.pattern:
            redacted = pattern.sub(r"\1<redacted>@", redacted)
        else:
            redacted = pattern.sub(r"\1<redacted>", redacted)
    return redacted


def parse_retry_after(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return max(float(value), 0.0)
    except ValueError:
        return None


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int
    base_backoff_seconds: float = 1.0
    max_backoff_seconds: float = 10.0
    jitter_seconds: float = 0.25
    sleep_fn: Callable[[float], None] = time.sleep
    random_fn: Callable[[], float] = random.random

    def compute_backoff(self, attempt_number: int, retry_after_seconds: float | None = None) -> float:
        if retry_after_seconds is not None:
            return min(retry_after_seconds, self.max_backoff_seconds)
        exponential = min(
            self.base_backoff_seconds * (2 ** max(attempt_number - 1, 0)),
            self.max_backoff_seconds,
        )
        return max(0.0, exponential + (self.random_fn() * self.jitter_seconds))

    def execute(self, request_fn: Callable[[int], requests.Response]) -> requests.Response:
        last_error: Exception | None = None
        for attempt in range(1, self.max_attempts + 1):
            try:
                response = request_fn(attempt)
            except (requests.Timeout, requests.ConnectionError) as exc:
                last_error = RetryableSourceError(
                    redact_sensitive_text(str(exc)),
                    error_type="timeout" if isinstance(exc, requests.Timeout) else "connection_error",
                )
            except RetryableSourceError as exc:
                last_error = exc
            except NonRetryableSourceError:
                raise
            else:
                if response.status_code == 400:
                    raise NonRetryableSourceError(
                        "Source returned HTTP 400 for the product request.",
                        error_type="bad_request",
                        status_code=400,
                    )
                if response.status_code == 401:
                    raise SourceAuthenticationError(
                        "Source returned HTTP 401. Check source authorization or configuration.",
                        error_type="authentication_error",
                        status_code=401,
                    )
                if response.status_code == 403:
                    raise SourceAccessBlockedError(
                        "Source returned HTTP 403. Collection for this source was stopped.",
                        error_type="http_403",
                        status_code=403,
                    )
                if response.status_code == 429:
                    last_error = RetryableSourceError(
                        "Source returned HTTP 429.",
                        error_type="http_429",
                        status_code=429,
                        retry_after_seconds=parse_retry_after(response.headers.get("Retry-After")),
                    )
                elif response.status_code in {500, 502, 503, 504}:
                    last_error = RetryableSourceError(
                        f"Source returned HTTP {response.status_code}.",
                        error_type="server_error",
                        status_code=response.status_code,
                    )
                elif response.status_code >= 400:
                    raise NonRetryableSourceError(
                        f"Source returned HTTP {response.status_code}.",
                        error_type="http_error",
                        status_code=response.status_code,
                    )
                else:
                    return response

            assert last_error is not None
            if attempt >= self.max_attempts:
                break
            if isinstance(last_error, RetryableSourceError):
                self.sleep_fn(
                    self.compute_backoff(attempt, last_error.retry_after_seconds),
                )

        if isinstance(last_error, RetryableSourceError):
            raise last_error
        if last_error is not None:
            raise last_error
        raise RuntimeError("Retry policy failed without a recorded error.")


def build_retry_policy(
    *,
    sleep_fn: Callable[[float], None] = time.sleep,
    random_fn: Callable[[], float] = random.random,
) -> RetryPolicy:
    config = get_config()
    return RetryPolicy(
        max_attempts=max(config.max_retry_attempts, 1),
        sleep_fn=sleep_fn,
        random_fn=random_fn,
    )
