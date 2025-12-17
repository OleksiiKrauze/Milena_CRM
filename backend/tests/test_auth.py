import pytest


def test_register_user(client):
    """Test user registration"""
    response = client.post(
        "/auth/register",
        json={
            "full_name": "New User",
            "phone": "+79997654321",
            "email": "newuser@example.com",
            "password": "newpassword123",
            "city": "Saint Petersburg"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New User"
    assert "password" not in data
    assert "password_hash" not in data


def test_register_duplicate_email(client, test_user):
    """Test registration with duplicate email fails"""
    response = client.post(
        "/auth/register",
        json={
            "full_name": "Duplicate User",
            "phone": "+79997654322",
            "email": "test@example.com",  # Already exists
            "password": "password123",
            "city": "Moscow"
        }
    )
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


def test_login_success(client, test_user):
    """Test successful login"""
    response = client.post(
        "/auth/login",
        json={
            "email": "test@example.com",
            "password": "testpassword"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, test_user):
    """Test login with wrong password fails"""
    response = client.post(
        "/auth/login",
        json={
            "email": "test@example.com",
            "password": "wrongpassword"
        }
    )
    assert response.status_code == 401


def test_login_nonexistent_user(client):
    """Test login with nonexistent user fails"""
    response = client.post(
        "/auth/login",
        json={
            "email": "nonexistent@example.com",
            "password": "password123"
        }
    )
    assert response.status_code == 401


def test_get_current_user(client, auth_headers, test_user):
    """Test getting current user info"""
    response = client.get("/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["full_name"] == "Test User"
    assert "password_hash" not in data


def test_get_current_user_unauthorized(client):
    """Test getting current user without authentication fails"""
    response = client.get("/auth/me")
    assert response.status_code == 403


def test_get_current_user_invalid_token(client):
    """Test getting current user with invalid token fails"""
    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid_token"}
    )
    assert response.status_code == 401
