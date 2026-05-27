from django.urls import path
from .views import LedgerMembersView

urlpatterns = [
    path("", LedgerMembersView.as_view()),
]
