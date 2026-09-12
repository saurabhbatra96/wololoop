# 02 - Order Matching Engine
#
# Run (Ctrl+Enter) executes this file. Run Tests (Ctrl+Shift+Enter) checks it.


class MatchingEngine:
    def __init__(self):
        raise NotImplementedError("MatchingEngine.__init__")

    def submit(self, order):
        """Match `order` against the book. Return the fills it caused."""
        raise NotImplementedError("submit")


if __name__ == "__main__":
    engine = MatchingEngine()
    print(engine.submit({"order_id": "A", "member": "M1", "side": "sell",
                         "price_cents": 1010, "quantity": 100}))
    print(engine.submit({"order_id": "B", "member": "M2", "side": "buy",
                         "price_cents": 1015, "quantity": 40}))
