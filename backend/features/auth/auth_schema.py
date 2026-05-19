from pydantic import BaseModel, EmailStr
from typing import Optional


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None

class RegisterRequest(BaseModel):
    first_name: str
    last_name:  str
    email:      EmailStr
    password:   str

class AuthResponse(BaseModel):
    token:      str
    user_id:    str
    first_name: str
    last_name:  str
    email:      str

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

class ChangePasswordRequest(BaseModel):
    new_password: str