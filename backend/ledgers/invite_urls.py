from django.urls import path
from .views import InviteAcceptView, InviteDetailView

urlpatterns = [
    path("<str:token>/", InviteDetailView.as_view()),
    path("<str:token>/accept/", InviteAcceptView.as_view()),
]
