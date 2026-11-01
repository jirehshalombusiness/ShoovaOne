"""Checks for folder-level access rules.

The rules never touch SharePoint itself: Graph is read with one app-only
identity, so these functions decide what a viewer may see afterwards.
"""

from app.services.integrations.sharepoint import relative_path
from app.services.integrations.sharepoint_access import (
    filter_visible,
    item_is_restricted,
    normalize_path,
    path_is_within,
)


def entry(name, *, item_id=None, path=None):
    return {
        "id": item_id or name.lower(),
        "name": name,
        "path": path,
        "is_folder": True,
    }


def test_relative_path_for_root_level_item():
    raw = {
        "name": "Finance",
        "parentReference": {
            "path": "/drives/drive-1/root:",
        },
    }

    assert relative_path(raw) == "/Finance"


def test_relative_path_for_nested_item():
    raw = {
        "name": "2025 Invoices",
        "parentReference": {
            "path": "/drives/drive-1/root:/Finance",
        },
    }

    assert relative_path(raw) == "/Finance/2025 Invoices"


def test_relative_path_is_empty_when_graph_omits_location():
    assert relative_path({"name": "orphan.pdf"}) == ""


DRIVE = {
    "webUrl": (
        "https://contoso.sharepoint.com/sites/Portal/"
        "Shared%20Documents"
    )
}


def test_relative_path_falls_back_to_web_url_for_search_hits():
    raw = {
        "name": "Budget.xlsx",
        "parentReference": {"id": "parent-1"},
        "webUrl": (
            "https://contoso.sharepoint.com/sites/Portal/"
            "Shared%20Documents/Finance/Budget.xlsx"
        ),
    }

    assert relative_path(raw, DRIVE) == "/Finance/Budget.xlsx"


def test_relative_path_ignores_urls_outside_the_drive():
    raw = {
        "name": "x",
        "webUrl": (
            "https://contoso.sharepoint.com/sites/Other/"
            "Shared%20Documents/x"
        ),
    }

    assert relative_path(raw, DRIVE) == ""


def test_path_matching_respects_segment_boundaries():
    assert path_is_within("/Finance/2025", "/Finance")
    assert path_is_within("/Finance", "/Finance")
    assert not path_is_within("/Finance Archive", "/Finance")
    assert not path_is_within("/HR/Finance", "/Finance")


def test_path_matching_is_case_insensitive():
    assert path_is_within("/finance/Payroll", "/Finance")
    assert normalize_path("Finance/") == "/Finance"


def test_item_is_restricted_by_path():
    assert item_is_restricted(
        entry("Payroll", path="/Finance/Payroll"),
        {"/Finance"},
        set(),
    )


def test_item_is_restricted_by_folder_id():
    assert item_is_restricted(
        entry("Finance", item_id="01PKKI", path="/Finance"),
        set(),
        {"01PKKI"},
    )


def test_item_without_a_known_location_fails_closed():
    assert item_is_restricted(
        entry("mystery", path=""),
        {"/Finance"},
        set(),
    )


def test_nothing_is_restricted_without_rules():
    assert not item_is_restricted(
        entry("mystery", path=""),
        set(),
        set(),
    )


def test_filter_visible_hides_restricted_subtree_only():
    items = [
        entry("Finance", path="/Finance"),
        entry("Budget.xlsx", path="/Finance/Budget.xlsx"),
        entry("Programs", path="/Programs & Projects"),
        entry("Finance Archive", path="/Finance Archive"),
    ]

    visible = filter_visible(items, {"/Finance"}, set())

    assert [item["name"] for item in visible] == [
        "Programs",
        "Finance Archive",
    ]


def test_filter_visible_keeps_everything_when_rule_is_satisfied():
    items = [entry("Finance", path="/Finance")]
    assert filter_visible(items, set(), set()) == items
