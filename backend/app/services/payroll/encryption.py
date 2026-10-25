import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


class BankAccountEncryption:
    """Encrypts payroll bank account numbers at rest.

    The key is supplied through PAYROLL_ENCRYPTION_KEY. In development, and
    until that variable is configured, a key is derived from JWT_SECRET_KEY.
    """

    @staticmethod
    def _fernet() -> Fernet:
        secret = settings.PAYROLL_ENCRYPTION_KEY or settings.JWT_SECRET_KEY
        digest = hashlib.sha256(secret.encode("utf-8")).digest()
        return Fernet(base64.urlsafe_b64encode(digest))

    @classmethod
    def encrypt(cls, account_number: str) -> str:
        return cls._fernet().encrypt(account_number.encode("utf-8")).decode("utf-8")

    @classmethod
    def decrypt(cls, token: str) -> str:
        try:
            return cls._fernet().decrypt(token.encode("utf-8")).decode("utf-8")
        except InvalidToken as exc:
            raise ValueError(
                "Bank account could not be decrypted. "
                "PAYROLL_ENCRYPTION_KEY may have changed."
            ) from exc

    @staticmethod
    def last4(account_number: str) -> str:
        cleaned = "".join(ch for ch in account_number if ch.isalnum())
        return cleaned[-4:]
