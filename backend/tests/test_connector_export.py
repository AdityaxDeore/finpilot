"""Connector exports are CSV (Excel-friendly), not JSON."""
import csv
import io

from app.api.connectors_router import _dataset, _to_csv


def test_multi_table_csv_has_titled_sections():
    text = _to_csv(_dataset("bank"))
    assert text.startswith("Accounts\r\nname,type,balance") and "\r\n\r\nLoans\r\n" in text


def test_single_table_csv_is_plain():
    rows = list(csv.reader(io.StringIO(_to_csv({"transactions": [{"id": "a", "tags": ["x"], "amount": -5.0}]}))))
    assert rows == [["id", "tags", "amount"], ["a", '["x"]', "-5.0"]]
