"""PDF text extraction and OpenRouter-backed structured extraction for competitor quotes.

Text-only pass: reads embedded PDF text via pypdf and sends it to a text LLM on OpenRouter's
free tier. Scanned/image-only PDFs (no embedded text) return an all-null extraction rather than
guessing -- a vision-based fallback is a documented future addition, not built here.
"""

import io
import json
import os
import re
import time
from pathlib import Path

import httpx
from pydantic import BaseModel, Field
from pypdf import PdfReader

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "nvidia/nemotron-3-nano-30b-a3b:free"
RETRY_ATTEMPTS = 4
RETRY_BACKOFF_SECONDS = 20

class ExtractedLineItem(BaseModel):
    part_name: str | None = None
    quantity: float | None = None
    unit_price: float | None = None
    line_total: float | None = None


class QuoteExtraction(BaseModel):
    supplier: str | None = None
    quote_date: str | None = None
    currency: str | None = None
    batch_charge_eur: float | None = None
    line_items: list[ExtractedLineItem] = Field(default_factory=list)
    raw_text_excerpt: str | None = None


_ENV_LOADED = False


def _load_env() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    _ENV_LOADED = True


def extract_pdf_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages).strip()


def _extraction_prompt(quote_text: str) -> str:
    return f"""You extract structured data from a competitor's manufacturing quote.

Return ONLY a JSON object matching this exact shape, nothing else -- no prose, no markdown fences:
{{
  "supplier": string or null,
  "quote_date": string or null (ISO 8601 date if determinable, else the raw date text),
  "currency": string or null (ISO currency code, e.g. "EUR"),
  "batch_charge_eur": number or null (any one-time engineering/admin/setup/batch charge, converted to EUR if the source currency is stated and unambiguous, else null),
  "line_items": [
    {{
      "part_name": string or null,
      "quantity": number or null,
      "unit_price": number or null,
      "line_total": number or null
    }}
  ]
}}

Rules:
- Never invent or guess a value. If a field is not explicitly present in the text, use null.
- Do not compute unit_price from line_total or vice versa -- only fill a field if that exact value appears in the text.
- Numbers must be plain numbers (no currency symbols, no thousands separators).

Quote text:
---
{quote_text}
---
"""


def _strip_json_fence(text: str) -> str:
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    return match.group(1) if match else text


def call_openrouter(prompt: str) -> str:
    """Calls OpenRouter's chat completions endpoint, retrying on 429s. Returns raw content string."""
    _load_env()
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    last_status: int | None = None
    for attempt in range(RETRY_ATTEMPTS):
        response = httpx.post(
            OPENROUTER_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": OPENROUTER_MODEL,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60,
        )
        if response.status_code == 429:
            last_status = 429
            if attempt < RETRY_ATTEMPTS - 1:
                time.sleep(RETRY_BACKOFF_SECONDS)
            continue
        response.raise_for_status()
        payload = response.json()
        return payload["choices"][0]["message"]["content"]

    raise RuntimeError(f"OpenRouter rate-limited after {RETRY_ATTEMPTS} retries (last status {last_status})")


def extract_quote(pdf_bytes: bytes) -> QuoteExtraction:
    quote_text = extract_pdf_text(pdf_bytes)
    if len(quote_text) < 20:
        return QuoteExtraction(raw_text_excerpt=quote_text or None)

    raw_content = call_openrouter(_extraction_prompt(quote_text))
    cleaned = _strip_json_fence(raw_content).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return QuoteExtraction(raw_text_excerpt=quote_text[:2000])

    line_items = [
        ExtractedLineItem(
            part_name=item.get("part_name"),
            quantity=item.get("quantity"),
            unit_price=item.get("unit_price"),
            line_total=item.get("line_total"),
        )
        for item in parsed.get("line_items") or []
        if isinstance(item, dict)
    ]
    return QuoteExtraction(
        supplier=parsed.get("supplier"),
        quote_date=parsed.get("quote_date"),
        currency=parsed.get("currency"),
        batch_charge_eur=parsed.get("batch_charge_eur"),
        line_items=line_items,
        raw_text_excerpt=quote_text[:2000],
    )
