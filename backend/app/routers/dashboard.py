from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db import get_db
from app.schemas.dashboard import DashboardStats, CaseStats, SearchStats, FieldSearchStats, DistributionStats
from app.models.case import Case
from app.models.search import Search
from app.models.field_search import FieldSearch
from app.models.distribution import Distribution
from app.models.user import User
from app.models.institutions_call import InstitutionsCall
from app.routers.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get aggregated statistics for dashboard"""

    # Case statistics
    total_cases = db.query(Case).count()
    cases_by_decision = db.query(
        Case.decision_type,
        func.count(Case.id)
    ).group_by(Case.decision_type).all()

    cases_by_decision_dict = {decision_type: count for decision_type, count in cases_by_decision}

    # Search statistics
    total_searches = db.query(Search).count()
    searches_by_status = db.query(
        Search.status,
        func.count(Search.id)
    ).group_by(Search.status).all()

    searches_by_status_dict = {status.name: count for status, count in searches_by_status}

    # Field search statistics
    total_field_searches = db.query(FieldSearch).count()
    field_searches_by_status = db.query(
        FieldSearch.status,
        func.count(FieldSearch.id)
    ).group_by(FieldSearch.status).all()

    field_searches_by_status_dict = {status.name: count for status, count in field_searches_by_status}

    # Distribution statistics
    total_distributions = db.query(Distribution).count()
    distributions_by_status = db.query(
        Distribution.status,
        func.count(Distribution.id)
    ).group_by(Distribution.status).all()

    distributions_by_status_dict = {status.name: count for status, count in distributions_by_status}

    # Other counts
    total_users = db.query(User).count()
    total_institutions_calls = db.query(InstitutionsCall).count()

    return DashboardStats(
        cases=CaseStats(
            total=total_cases,
            by_decision=cases_by_decision_dict
        ),
        searches=SearchStats(
            total=total_searches,
            by_status=searches_by_status_dict
        ),
        field_searches=FieldSearchStats(
            total=total_field_searches,
            by_status=field_searches_by_status_dict
        ),
        distributions=DistributionStats(
            total=total_distributions,
            by_status=distributions_by_status_dict
        ),
        total_users=total_users,
        total_institutions_calls=total_institutions_calls
    )
