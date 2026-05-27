from django.urls import path
from .views import CatalogItemListCreateView

urlpatterns = [
    path("", CatalogItemListCreateView.as_view()),
]
