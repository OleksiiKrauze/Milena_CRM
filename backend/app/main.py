from fastapi import FastAPI
from sqlalchemy import text
from app.db import engine

app = FastAPI(title="Missing CRM API", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db-check")
def db_check():
    # простой тест: можем ли выполнить запрос к Postgres
    with engine.connect() as conn:
        val = conn.execute(text("SELECT 1")).scalar_one()
    return {"db": "ok", "select_1": val}
