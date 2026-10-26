"""Pydantic request/response schemas."""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator


# Одна картинка в data-URL. 1.5 МБ base64 ≈ 1.1 МБ исходного файла — этого
# хватает для скриншота экрана и не даёт превратить /api/ai в приём мусора.
MAX_IMAGE_CHARS = 1_500_000


class AIRequest(BaseModel):
    mode: Literal["scratch", "edit"] = "edit"
    message: str = Field(..., min_length=1, max_length=20000)
    html: str = Field("", max_length=400000)
    model: Optional[str] = Field(None, max_length=120)
    # Без ограничения список картинок был единственным полем без потолка:
    # модели уходили только первые 4, а в память запроса до этого попадал
    # любой объём, который клиент захотел прислать.
    images: Optional[List[str]] = Field(None, max_length=4)

    @field_validator("images")
    @classmethod
    def small_images(cls, value):
        if value and any(len(item or "") > MAX_IMAGE_CHARS for item in value):
            raise ValueError(f"каждая картинка должна быть меньше {MAX_IMAGE_CHARS // 1000} КБ в base64")
        return value


class AIResponse(BaseModel):
    html: str
    model: str
    say: str = ""


class ProjectIn(BaseModel):
    id: Optional[str] = None
    name: str = Field("Без названия", max_length=200)
    html: str = Field("", max_length=800000)
    kind: str = Field("project", max_length=40)


class ProjectMeta(BaseModel):
    id: str
    name: str
    kind: str
    created: str
    updated: str
    owner: str = ""


class Project(ProjectMeta):
    html: str


class AuditItem(BaseModel):
    sev: Literal["high", "med", "low", "ok"]
    title: str
    desc: str
    fix: str = ""


class AuditResponse(BaseModel):
    score: int
    items: List[AuditItem]
    high: int
    med: int
    low: int
    summary: str


class AuthIn(BaseModel):
    username: str = Field(..., min_length=3, max_length=40)
    password: str = Field(..., min_length=6, max_length=200)


class AuthOut(BaseModel):
    token: str
    username: str
    plan: str = "free"


class Me(BaseModel):
    id: Optional[str] = None
    username: str
    plan: str = "free"
    subscription_status: Optional[str] = None
    subscription_expires_at: Optional[str] = None
    enabled: bool
