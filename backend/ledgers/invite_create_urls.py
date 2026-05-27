from django.urls import path
from .views import InviteCreateView

urlpatterns = [
    path("", InviteCreateView.as_view()),
]
