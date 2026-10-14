"""
Authentication Router: Signup, Login, Me, and Role Verification
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from backend.src.db.connection import get_db_session
from backend.src.db.models import User, UserRole, AuditLog
from backend.src.auth.security import hash_password, verify_password, create_access_token, decode_access_token

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

VALID_ROLES = [role.value for role in UserRole]

# Schemas
class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str
    factory_name: Optional[str] = "Yantra Manufacturing Unit 1"
    phone_number: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

# Dependency: Get Current User
async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db_session)
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token"
        )
    
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid token"
        )

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account deactivated"
        )
    return user

# Helper: Require Specific Roles
def require_roles(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied for role '{current_user.role}'. Required one of: {allowed_roles}"
            )
        return current_user
    return role_checker

@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db_session)):
    req_email = req.email.strip().lower()
    req_role = req.role.strip().lower()

    if req_role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{req.role}'. Must be one of: {VALID_ROLES}"
        )

    if len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    # Check existing user
    existing = await db.execute(select(User).where(User.email == req_email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    new_user = User(
        email=req_email,
        full_name=req.full_name.strip(),
        hashed_password=hash_password(req.password),
        role=req_role,
        factory_name=req.factory_name.strip() if req.factory_name else "Yantra Manufacturing Unit 1",
        phone_number=req.phone_number.strip() if req.phone_number else None
    )
    db.add(new_user)
    await db.flush()

    # Log audit
    log = AuditLog(
        user_id=new_user.id,
        user_email=new_user.email,
        action="USER_SIGNUP",
        details=f"Account created with role {new_user.role}"
    )
    db.add(log)
    await db.commit()
    await db.refresh(new_user)

    token = create_access_token({
        "sub": str(new_user.id),
        "email": new_user.email,
        "role": new_user.role,
        "name": new_user.full_name
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user.to_dict()
    }

@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db_session)):
    req_email = req.email.strip().lower()
    result = await db.execute(select(User).where(User.email == req_email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact factory administrator."
        )

    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "name": user.full_name
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user.to_dict()
    }

@router.get("/me")
async def get_current_user_profile(user: User = Depends(get_current_user)):
    role_permissions = {
        "maintenance_engineer": [
            "view_fleet_matrix",
            "run_gemma_diagnosis",
            "upload_equipment_photo",
            "complete_corrective_action",
            "view_personal_sla"
        ],
        "supervisor": [
            "view_fleet_matrix",
            "run_gemma_diagnosis",
            "assign_corrective_tasks",
            "manage_sla_deadlines",
            "handle_level2_escalations",
            "complete_corrective_action"
        ],
        "factory_owner": [
            "view_fleet_matrix",
            "view_factory_financial_exposure",
            "manage_cost_parameters",
            "handle_level3_executive_escalations",
            "view_savings_audit_ledger",
            "assign_corrective_tasks",
            "complete_corrective_action"
        ]
    }

    user_info = user.to_dict()
    user_info["permissions"] = role_permissions.get(user.role, [])
    return user_info

@router.post("/seed-demo-users")
async def seed_demo_users(db: AsyncSession = Depends(get_db_session)):
    """Convenience helper to seed 3 demo accounts for quick role-switching in demos."""
    demo_accounts = [
        {
            "email": "engineer@yantrawatch.com",
            "password": "password123",
            "full_name": "Ramesh Sharma",
            "role": "maintenance_engineer",
            "factory_name": "Yantra Unit 1",
            "phone_number": "+91 98765 43210"
        },
        {
            "email": "supervisor@yantrawatch.com",
            "password": "password123",
            "full_name": "Rajesh Verma",
            "role": "supervisor",
            "factory_name": "Yantra Unit 1",
            "phone_number": "+91 98765 43211"
        },
        {
            "email": "owner@yantrawatch.com",
            "password": "password123",
            "full_name": "Vikram Singhania",
            "role": "factory_owner",
            "factory_name": "Yantra Unit 1",
            "phone_number": "+91 98765 43212"
        }
    ]

    created = []
    for acc in demo_accounts:
        existing = await db.execute(select(User).where(User.email == acc["email"]))
        if not existing.scalar_one_or_none():
            u = User(
                email=acc["email"],
                hashed_password=hash_password(acc["password"]),
                full_name=acc["full_name"],
                role=acc["role"],
                factory_name=acc["factory_name"],
                phone_number=acc["phone_number"]
            )
            db.add(u)
            created.append(acc["email"])
    
    await db.commit()
    return {"message": "Demo accounts verified/seeded", "created": created}
