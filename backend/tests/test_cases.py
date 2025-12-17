import pytest


@pytest.fixture
def sample_case_data():
    """Sample case data for testing"""
    return {
        "applicant_full_name": "Иван Петров",
        "applicant_phone": "+79991234567",
        "applicant_relation": "Брат",
        "missing_full_name": "Мария Петрова",
        "missing_gender": "Женский",
        "missing_birthdate": "1990-05-15",
        "missing_last_seen_place": "Москва, ул. Ленина, 10",
        "missing_description": "Рост 165 см, темные волосы",
        "tags": ["срочно", "москва"]
    }


def test_create_case(client, auth_headers, sample_case_data):
    """Test creating a new case"""
    response = client.post(
        "/cases/",
        json=sample_case_data,
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["applicant_full_name"] == sample_case_data["applicant_full_name"]
    assert data["missing_full_name"] == sample_case_data["missing_full_name"]
    assert data["case_status"] == "new"
    assert "id" in data
    assert "created_at" in data


def test_create_case_unauthorized(client, sample_case_data):
    """Test creating a case without authentication fails"""
    response = client.post("/cases/", json=sample_case_data)
    assert response.status_code == 403


def test_list_cases(client, auth_headers, sample_case_data):
    """Test listing cases with pagination"""
    # Create a few cases
    for i in range(3):
        client.post("/cases/", json=sample_case_data, headers=auth_headers)

    response = client.get("/cases/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "cases" in data
    assert data["total"] == 3
    assert len(data["cases"]) == 3


def test_list_cases_with_pagination(client, auth_headers, sample_case_data):
    """Test listing cases with skip and limit"""
    # Create 5 cases
    for i in range(5):
        client.post("/cases/", json=sample_case_data, headers=auth_headers)

    response = client.get("/cases/?skip=2&limit=2", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 5
    assert len(data["cases"]) == 2


def test_get_case_by_id(client, auth_headers, sample_case_data):
    """Test getting a case by ID"""
    # Create a case
    create_response = client.post(
        "/cases/",
        json=sample_case_data,
        headers=auth_headers
    )
    case_id = create_response.json()["id"]

    # Get the case
    response = client.get(f"/cases/{case_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == case_id
    assert data["missing_full_name"] == sample_case_data["missing_full_name"]


def test_get_nonexistent_case(client, auth_headers):
    """Test getting a nonexistent case returns 404"""
    response = client.get("/cases/99999", headers=auth_headers)
    assert response.status_code == 404


def test_update_case(client, auth_headers, sample_case_data):
    """Test updating a case"""
    # Create a case
    create_response = client.post(
        "/cases/",
        json=sample_case_data,
        headers=auth_headers
    )
    case_id = create_response.json()["id"]

    # Update the case
    update_data = {
        "missing_description": "Обновленное описание",
        "case_status": "in_progress"
    }
    response = client.put(
        f"/cases/{case_id}",
        json=update_data,
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["missing_description"] == "Обновленное описание"
    assert data["case_status"] == "in_progress"
    # Other fields should remain unchanged
    assert data["missing_full_name"] == sample_case_data["missing_full_name"]


def test_delete_case(client, auth_headers, sample_case_data):
    """Test deleting a case"""
    # Create a case
    create_response = client.post(
        "/cases/",
        json=sample_case_data,
        headers=auth_headers
    )
    case_id = create_response.json()["id"]

    # Delete the case
    response = client.delete(f"/cases/{case_id}", headers=auth_headers)
    assert response.status_code == 204

    # Verify it's deleted
    get_response = client.get(f"/cases/{case_id}", headers=auth_headers)
    assert get_response.status_code == 404


def test_get_case_full(client, auth_headers, sample_case_data):
    """Test getting a case with all related data"""
    # Create a case
    create_response = client.post(
        "/cases/",
        json=sample_case_data,
        headers=auth_headers
    )
    case_id = create_response.json()["id"]

    # Get full case data
    response = client.get(f"/cases/{case_id}/full", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == case_id
    assert "searches" in data
    assert "field_searches" in data
    assert "institutions_calls" in data
    assert isinstance(data["searches"], list)
    assert isinstance(data["field_searches"], list)
    assert isinstance(data["institutions_calls"], list)


def test_filter_cases_by_status(client, auth_headers, sample_case_data):
    """Test filtering cases by status"""
    # Create cases with different statuses
    client.post("/cases/", json=sample_case_data, headers=auth_headers)

    create_response = client.post("/cases/", json=sample_case_data, headers=auth_headers)
    case_id = create_response.json()["id"]
    client.put(
        f"/cases/{case_id}",
        json={"case_status": "in_progress"},
        headers=auth_headers
    )

    # Filter by status
    response = client.get("/cases/?status_filter=new", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert all(case["case_status"] == "new" for case in data["cases"])
