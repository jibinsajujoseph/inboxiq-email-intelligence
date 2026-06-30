import base64
from cryptography.fernet import Fernet
from app.config.settings import settings

class CryptoService:
    def __init__(self):
        # We need a 32 url-safe base64-encoded byte string for Fernet.
        # We'll take the SECRET_KEY, pad it or truncate it, and encode it.
        raw_key = settings.SECRET_KEY.encode('utf-8')
        # Ensure it is exactly 32 bytes
        padded_key = raw_key.ljust(32, b'0')[:32]
        fernet_key = base64.urlsafe_b64encode(padded_key)
        self.cipher = Fernet(fernet_key)

    def encrypt(self, value: str) -> str:
        """Encrypts a string and returns the encrypted string."""
        if not value:
            return value
        return self.cipher.encrypt(value.encode('utf-8')).decode('utf-8')

    def decrypt(self, encrypted_value: str) -> str:
        """Decrypts a string and returns the plaintext."""
        if not encrypted_value:
            return encrypted_value
        return self.cipher.decrypt(encrypted_value.encode('utf-8')).decode('utf-8')

crypto_service = CryptoService()
