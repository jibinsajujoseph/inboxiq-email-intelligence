import os
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
import google_auth_oauthlib.flow
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.config.settings import settings
from app.models.orm import Credential
from app.services.crypto_service import crypto_service

router = APIRouter(prefix="/auth/google", tags=["Auth"])

# Gmail API scopes required
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_client_config():
    return {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "project_id": "inboxiq-mvp",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI]
        }
    }

@router.get("/connect")
def connect():
    """Redirects the user to Google's consent screen."""
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        get_client_config(),
        scopes=SCOPES
    )
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    
    # Offline access is required to get a refresh token
    # prompt=consent ensures Google always sends a refresh token
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        prompt='consent'
    )
    return RedirectResponse(authorization_url)

@router.get("/callback")
def callback(request: Request, db: Session = Depends(get_db)):
    """Handles the OAuth2 callback from Google."""
    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        get_client_config(),
        scopes=SCOPES
    )
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    
    try:
        # Exchange the authorization code for an access token and refresh token
        flow.fetch_token(code=code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch token: {str(e)}")

    credentials = flow.credentials
    refresh_token = credentials.refresh_token
    
    if not refresh_token:
        # If no refresh token is returned, the app needs to be re-authorized with prompt='consent'
        raise HTTPException(status_code=400, detail="No refresh token returned. Try connecting again.")

    # In a real app we might get the user's email here using an additional scope, 
    # but for a single-inbox MVP we'll just store a placeholder or try to infer it.
    # For now, we'll store 'default_inbox' since it's a single inbox app.
    account_email = "default_inbox"

    encrypted_token = crypto_service.encrypt(refresh_token)

    # Upsert credential
    existing_cred = db.query(Credential).filter(Credential.account_email == account_email).first()
    if existing_cred:
        existing_cred.encrypted_refresh_token = encrypted_token
        existing_cred.status = "active"
    else:
        new_cred = Credential(
            provider="gmail",
            account_email=account_email,
            encrypted_refresh_token=encrypted_token,
            status="active"
        )
        db.add(new_cred)
    
    db.commit()
    return {"message": "Successfully connected and stored credentials."}
