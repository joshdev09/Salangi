import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.db.database import Base, engine
from backend.features.auth.auth_router import router as auth_router
from backend.features.listings.listings_router import router as listings_router

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI()

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://salangi.online",
        "https://www.salangi.online",
        frontend_url,
        frontend_url.replace("https://www.", "https://"),
        frontend_url.replace("https://", "https://www."),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(listings_router)