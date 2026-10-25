import unicodedata
from typing import Annotated

from pydantic import BeforeValidator, EmailStr


def normalize_email(value):
    """Strip whitespace and invisible formatting characters from an email.

    Addresses pasted from documents often carry zero-width or word-joiner
    characters. They persist in the database but fail EmailStr validation and
    break email delivery.
    """
    if not isinstance(value, str):
        return value
    return ''.join(
        char
        for char in value
        if unicodedata.category(char) != 'Cf' and not char.isspace()
    )


ValidEmail = Annotated[EmailStr, BeforeValidator(normalize_email)]
