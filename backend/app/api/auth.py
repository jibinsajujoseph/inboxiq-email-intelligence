import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
import google_auth_oauthlib.flow
from googleapiclient.discovery import build
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.config.settings import settings
from app.models.orm import Credential
from app.services.crypto_service import crypto_service
from app.services.gmail_service import GmailService, ReauthRequiredError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/google", tags=["Auth"])
gmail_service = GmailService()

# Gmail API scopes required
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']


def get_latest_gmail_credential(db: Session) -> Credential | None:
    return (
        db.query(Credential)
        .filter(Credential.provider == "gmail")
        .order_by(Credential.updated_at.desc())
        .first()
    )


def get_active_gmail_credential(db: Session) -> Credential | None:
    return (
        db.query(Credential)
        .filter(
            Credential.provider == "gmail",
            Credential.status == "active",
        )
        .order_by(Credential.updated_at.desc())
        .first()
    )

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

    account_email = None
    try:
        gmail_client = build("gmail", "v1", credentials=credentials, cache_discovery=False)
        profile = gmail_client.users().getProfile(userId="me").execute()
        account_email = profile.get("emailAddress") or account_email
    except Exception as exc:
        logger.warning(
            "Unable to resolve Gmail account email from profile during callback.",
            exc_info=exc,
        )

    encrypted_token = crypto_service.encrypt(refresh_token)

    # Upsert credential by provider, then keep the latest active record.
    existing_cred = get_latest_gmail_credential(db)
    if existing_cred:
        existing_cred.account_email = account_email
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

@router.post("/disconnect")
def disconnect(db: Session = Depends(get_db)):
    creds = (
        db.query(Credential)
        .filter(Credential.provider == "gmail", Credential.status == "active")
        .all()
    )
    if not creds:
        raise HTTPException(status_code=404, detail="No active Gmail connection found.")
    for cred in creds:
        cred.status = "inactive"
    db.commit()
    return {"disconnected": True}

@router.get("/status")
def status(db: Session = Depends(get_db)):
    """Returns the current connection status."""
    cred = get_active_gmail_credential(db)
    if cred:
        try:
            gmail_client = gmail_service.build_client(db)
            profile = gmail_client.users().getProfile(userId="me").execute()
            resolved_email = profile.get("emailAddress") or cred.account_email

            if resolved_email != cred.account_email:
                cred.account_email = resolved_email
                db.commit()

            return {"connected": True, "email": resolved_email}
        except ReauthRequiredError:
            return {"connected": False, "email": None}
        except Exception as exc:
            logger.warning(
                "Unable to refresh Gmail account email from profile for auth status.",
                exc_info=exc,
            )
            return {"connected": True, "email": cred.account_email}
    return {"connected": False, "email": None}
