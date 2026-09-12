"""Reference solution - 02 Order Matching Engine.

The shape that matters: two heaps for price-time priority, one dict as the
order index, and *lazy deletion*. Cancelling does not remove anything from a
heap - it flips a flag, and the heap top is cleaned up the next time someone
looks at it. Trying to remove from the middle of a binary heap is how this
problem goes wrong.
"""

import heapq
import itertools


class MatchingEngine:
    def __init__(self):
        self._bids = []          # max-heap by price, then arrival: (-price, seq, id)
        self._asks = []          # min-heap by price, then arrival: (price, seq, id)
        self._orders = {}        # order_id -> live order record
        self._seq = itertools.count()

    # -------------------------------------------------------------- part 1

    def _peek(self, book):
        """Top live order on a book, discarding anything stale on the way."""
        while book:
            order = self._orders[book[0][2]]
            if order["live"] and order["remaining"] > 0:
                return order
            heapq.heappop(book)
        return None

    def _rest(self, order):
        if order["side"] == "buy":
            heapq.heappush(self._bids, (-order["price_cents"], order["seq"], order["order_id"]))
        else:
            heapq.heappush(self._asks, (order["price_cents"], order["seq"], order["order_id"]))

    def submit(self, incoming):
        taker = {
            "order_id": incoming["order_id"],
            "member": incoming.get("member"),
            "side": incoming["side"],
            "price_cents": incoming.get("price_cents"),
            "remaining": incoming["quantity"],
            "seq": next(self._seq),
            "live": True,
        }
        self._orders[taker["order_id"]] = taker

        opposite = self._asks if taker["side"] == "buy" else self._bids
        fills = []

        while taker["remaining"] > 0:
            maker = self._peek(opposite)
            if maker is None or not self._crosses(taker, maker):
                break

            # part 3: never trade with yourself - drop the resting side.
            if taker["member"] is not None and maker["member"] == taker["member"]:
                maker["live"] = False
                heapq.heappop(opposite)
                continue

            traded = min(taker["remaining"], maker["remaining"])
            fills.append((taker["order_id"], maker["order_id"], traded, maker["price_cents"]))
            taker["remaining"] -= traded
            maker["remaining"] -= traded
            if maker["remaining"] == 0:
                maker["live"] = False
                heapq.heappop(opposite)

        # A market order never rests: whatever is left is simply gone.
        if taker["remaining"] > 0 and taker["price_cents"] is not None:
            self._rest(taker)
        else:
            taker["live"] = False

        return fills

    def _crosses(self, taker, maker):
        if taker["price_cents"] is None:      # market order takes any price
            return True
        if taker["side"] == "buy":
            return maker["price_cents"] <= taker["price_cents"]
        return maker["price_cents"] >= taker["price_cents"]

    # -------------------------------------------------------------- part 2

    def cancel(self, order_id):
        order = self._orders.get(order_id)
        if order is None or not order["live"] or order["remaining"] == 0:
            return False
        order["live"] = False
        return True

    def book(self):
        bids, asks = {}, {}
        for order in self._orders.values():
            if not order["live"] or order["remaining"] <= 0:
                continue
            side = bids if order["side"] == "buy" else asks
            side[order["price_cents"]] = side.get(order["price_cents"], 0) + order["remaining"]
        return {
            "bids": sorted(bids.items(), key=lambda level: -level[0]),
            "asks": sorted(asks.items()),
        }

    # -------------------------------------------------------------- part 3

    def best_bid(self):
        top = self._peek(self._bids)
        return top["price_cents"] if top else None

    def best_ask(self):
        top = self._peek(self._asks)
        return top["price_cents"] if top else None

    def spread(self):
        bid, ask = self.best_bid(), self.best_ask()
        return None if bid is None or ask is None else ask - bid
