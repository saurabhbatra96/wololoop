"""Reference solution - 08 Inventory Allocation.

Allocation problems live or die on tie-break rules. "Pick the nearest
warehouse" is not a specification until you say what happens when two are
equidistant, and a system that answers differently on each deploy because it
iterated a dict will generate support tickets forever. Every ordering here is
total.
"""

# ---------------------------------------------------------------- part 1

def _usable(lot, today):
    """Expired stock cannot be shipped. Expiry on `today` is already too late."""
    return lot["expires_at"] > today


def _fefo(lots):
    """First expired, first out - with a deterministic tail on the sort key."""
    return sorted(lots, key=lambda lot: (lot["expires_at"], lot["received_at"], lot["lot_id"]))


def allocate(lots, orders, today):
    """Fill orders from the stock that expires soonest."""
    remaining = {lot["lot_id"]: lot["quantity"] for lot in lots}
    by_sku = {}
    for lot in _fefo(lots):
        if _usable(lot, today):
            by_sku.setdefault(lot["sku"], []).append(lot)

    allocations = {}
    shortfalls = {}

    for order in orders:
        needed = order["quantity"]
        picks = []
        for lot in by_sku.get(order["sku"], []):
            if needed == 0:
                break
            take = min(needed, remaining[lot["lot_id"]])
            if take == 0:
                continue
            remaining[lot["lot_id"]] -= take
            needed -= take
            picks.append((lot["lot_id"], take))
        allocations[order["order_id"]] = picks
        if needed:
            shortfalls[order["order_id"]] = needed

    return {"allocations": allocations, "shortfalls": shortfalls}


# ---------------------------------------------------------------- part 2

def allocate_multi(lots, orders, distances, today):
    """Prefer one warehouse per order; fall back to nearest-first splitting."""
    remaining = {lot["lot_id"]: lot["quantity"] for lot in lots}
    by_warehouse = {}
    for lot in _fefo(lots):
        if _usable(lot, today):
            by_warehouse.setdefault((lot["warehouse"], lot["sku"]), []).append(lot)

    warehouses = sorted({lot["warehouse"] for lot in lots})

    allocations = {}
    shortfalls = {}

    for order in orders:
        region = order["region"]
        reachable = sorted(
            (w for w in warehouses if (w, region) in distances),
            key=lambda w: (distances[(w, region)], w),
        )

        def stock(warehouse):
            return sum(remaining[lot["lot_id"]]
                       for lot in by_warehouse.get((warehouse, order["sku"]), []))

        # A single shipment beats a cheap one: look for one warehouse that can
        # cover the whole order before considering any split.
        whole = [w for w in reachable if stock(w) >= order["quantity"]]
        chosen = [whole[0]] if whole else reachable

        needed = order["quantity"]
        picks = []
        for warehouse in chosen:
            for lot in by_warehouse.get((warehouse, order["sku"]), []):
                if needed == 0:
                    break
                take = min(needed, remaining[lot["lot_id"]])
                if take == 0:
                    continue
                remaining[lot["lot_id"]] -= take
                needed -= take
                picks.append((warehouse, lot["lot_id"], take))

        allocations[order["order_id"]] = picks
        if needed:
            shortfalls[order["order_id"]] = needed

    return {"allocations": allocations, "shortfalls": shortfalls}


# ---------------------------------------------------------------- part 3

class ReservationLedger:
    """Holds stock for a checkout that hasn't paid yet.

    Reservations expire lazily: nothing runs on a timer, we just refuse to
    count expired holds whenever someone asks. That keeps the ledger correct
    without a sweeper process, which is the usual shape of this in production.
    """

    def __init__(self, lots, today):
        self._stock = {}
        for lot in lots:
            if _usable(lot, today):
                self._stock[lot["sku"]] = self._stock.get(lot["sku"], 0) + lot["quantity"]
        self._holds = {}      # order_id -> {sku, quantity, expires_at, confirmed}

    def _active(self, sku, now):
        return sum(hold["quantity"] for hold in self._holds.values()
                   if hold["sku"] == sku and (hold["confirmed"] or hold["expires_at"] > now))

    def available(self, sku, now):
        return self._stock.get(sku, 0) - self._active(sku, now)

    def reserve(self, order_id, sku, quantity, now, ttl_seconds):
        if quantity <= 0:
            return False
        existing = self._holds.get(order_id)
        if existing is not None:
            if existing["confirmed"] or existing["expires_at"] > now:
                return False
            del self._holds[order_id]      # the old hold lapsed; let them retry
        if self.available(sku, now) < quantity:
            return False
        self._holds[order_id] = {"sku": sku, "quantity": quantity,
                                 "expires_at": now + ttl_seconds, "confirmed": False}
        return True

    def confirm(self, order_id, now):
        hold = self._holds.get(order_id)
        if hold is None or hold["confirmed"] or hold["expires_at"] <= now:
            return False
        hold["confirmed"] = True
        return True

    def cancel(self, order_id):
        hold = self._holds.get(order_id)
        if hold is None or hold["confirmed"]:
            return False
        del self._holds[order_id]
        return True
