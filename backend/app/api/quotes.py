from fastapi import APIRouter

from app.costing.calculator import calculate_quote
from app.costing.schemas import QuoteInput, QuoteResult

router = APIRouter(tags=["quotes"])


@router.post("/quotes/calculate", response_model=QuoteResult)
def calculate_quote_endpoint(quote: QuoteInput) -> QuoteResult:
    return calculate_quote(quote)

