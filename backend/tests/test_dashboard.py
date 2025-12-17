import pytest


def test_dashboard_stats_empty(client, auth_headers):
    """Test dashboard stats with empty database"""
    response = client.get("/dashboard/stats", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    assert "cases" in data
    assert "searches" in data
    assert "field_searches" in data
    assert "distributions" in data
    assert "total_users" in data
    assert "total_institutions_calls" in data

    assert data["cases"]["total"] == 0
    assert data["searches"]["total"] == 0
    assert data["field_searches"]["total"] == 0
    assert data["distributions"]["total"] == 0


def test_dashboard_stats_with_data(client, auth_headers):
    """Test dashboard stats with some data"""
    # Create a case
    case_data = {
        "applicant_full_name": "Иван Петров",
        "missing_full_name": "Мария Петрова",
        "tags": []
    }
    case_response = client.post("/cases/", json=case_data, headers=auth_headers)
    case_id = case_response.json()["id"]

    # Create a search
    search_data = {
        "case_id": case_id,
        "status": "planned"
    }
    client.post("/searches/", json=search_data, headers=auth_headers)

    # Get dashboard stats
    response = client.get("/dashboard/stats", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["cases"]["total"] == 1
    assert data["searches"]["total"] == 1
    assert "new" in data["cases"]["by_status"]
    assert data["cases"]["by_status"]["new"] == 1


def test_dashboard_stats_unauthorized(client):
    """Test dashboard stats without authentication fails"""
    response = client.get("/dashboard/stats")
    assert response.status_code == 403


def test_dashboard_stats_by_status_breakdown(client, auth_headers):
    """Test dashboard stats shows correct breakdown by status"""
    # Create cases with different statuses
    case_data = {
        "applicant_full_name": "Иван Петров",
        "missing_full_name": "Мария Петрова",
        "tags": []
    }

    # Create 2 new cases
    client.post("/cases/", json=case_data, headers=auth_headers)
    client.post("/cases/", json=case_data, headers=auth_headers)

    # Create 1 in_progress case
    response = client.post("/cases/", json=case_data, headers=auth_headers)
    case_id = response.json()["id"]
    client.put(
        f"/cases/{case_id}",
        json={"case_status": "in_progress"},
        headers=auth_headers
    )

    # Get stats
    response = client.get("/dashboard/stats", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["cases"]["total"] == 3
    assert data["cases"]["by_status"]["new"] == 2
    assert data["cases"]["by_status"]["in_progress"] == 1
