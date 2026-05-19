from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = Field(None, max_length=64)
    last_name:  Optional[str] = Field(None, max_length=64)
    email:      Optional[EmailStr] = None

class RegisterRequest(BaseModel):
    first_name: str     = Field(..., max_length=64)
    last_name:  str     = Field(..., max_length=64)
    email:      EmailStr
    password:   str     = Field(..., min_length=8, max_length=128)

class AuthResponse(BaseModel):
    token:      str
    user_id:    str
    first_name: str
    last_name:  str
    email:      str

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str       = Field(..., max_length=128)

class ChangePasswordRequest(BaseModel):
    new_password: str   = Field(..., min_length=8, max_length=128)