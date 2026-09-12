# 08 - Inventory Allocation

LOTS = [
    {"lot_id": "L1", "sku": "TEA", "warehouse": "W1", "quantity": 40,
     "received_at": "2026-05-01", "expires_at": "2026-07-01"},
    {"lot_id": "L2", "sku": "TEA", "warehouse": "W1", "quantity": 60,
     "received_at": "2026-04-01", "expires_at": "2026-09-01"},
]


def allocate(lots, orders, today):
    """{"allocations": {order_id: [(lot_id, qty), ...]}, "shortfalls": {...}}"""
    raise NotImplementedError("allocate")


if __name__ == "__main__":
    print(allocate(LOTS, [{"order_id": "O1", "sku": "TEA", "quantity": 50}], "2026-06-01"))
