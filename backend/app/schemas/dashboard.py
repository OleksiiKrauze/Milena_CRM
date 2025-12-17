from pydantic import BaseModel
from typing import Dict


class CaseStats(BaseModel):
    """Statistics for cases"""
    total: int
    by_status: Dict[str, int]


class SearchStats(BaseModel):
    """Statistics for searches"""
    total: int
    by_status: Dict[str, int]


class FieldSearchStats(BaseModel):
    """Statistics for field searches"""
    total: int
    by_status: Dict[str, int]


class DistributionStats(BaseModel):
    """Statistics for distributions"""
    total: int
    by_status: Dict[str, int]


class DashboardStats(BaseModel):
    """Aggregated dashboard statistics"""
    cases: CaseStats
    searches: SearchStats
    field_searches: FieldSearchStats
    distributions: DistributionStats
    total_users: int
    total_institutions_calls: int
