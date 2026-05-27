from django.db import models


class LedgerKind(models.TextChoices):
    SHARED = "shared", "Shared"
    PERSONAL = "personal", "Personal"


class MemberRole(models.TextChoices):
    OWNER = "owner", "Owner"
    EDITOR = "editor", "Editor"
    VIEWER = "viewer", "Viewer"
