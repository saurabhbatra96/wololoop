# 01 - Trade Settlement Netting
#
# Write your solution here. Run (Ctrl+Enter) executes this file.
# Run Tests (Ctrl+Shift+Enter) checks it against the current part.

SAMPLE_TRADES = [
    {"trade_id": "T1", "buyer": "ALPHA", "seller": "BRAVO", "symbol": "ACME",
     "quantity": 100, "price_cents": 1050, "currency": "USD", "trade_date": "2026-03-02"},
    {"trade_id": "T2", "buyer": "BRAVO", "seller": "CIRRUS", "symbol": "ACME",
     "quantity": 40, "price_cents": 1100, "currency": "USD", "trade_date": "2026-03-02"},
    {"trade_id": "T3", "buyer": "CIRRUS", "seller": "ALPHA", "symbol": "ZINC",
     "quantity": 25, "price_cents": 2000, "currency": "USD", "trade_date": "2026-03-02"},
    {"trade_id": "T4", "buyer": "ALPHA", "seller": "BRAVO", "symbol": "ACME",
     "quantity": 100, "price_cents": 1000, "currency": "USD", "trade_date": "2026-03-02"},
    {"trade_id": "T5", "buyer": "BRAVO", "seller": "ALPHA", "symbol": "ZINC",
     "quantity": 25, "price_cents": 1900, "currency": "USD", "trade_date": "2026-03-02"},
]


def net_positions(trades):
    """Return {(member, symbol): net_quantity}, dropping anything that nets flat."""
    raise NotImplementedError("net_positions")


if __name__ == "__main__":
    print(net_positions(SAMPLE_TRADES))
