from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .enums import MemberRole
from .models import Ledger, LedgerMember, InviteToken
from .permissions import IsMember, IsOwnerOrEditor
from .serializers import LedgerSerializer, InviteTokenSerializer, InviteCreateSerializer


class LedgerListCreateView(generics.ListCreateAPIView):
    serializer_class = LedgerSerializer

    def get_queryset(self):
        return Ledger.objects.filter(members__user=self.request.user, archived_at__isnull=True)

    def perform_create(self, serializer):
        ledger = serializer.save(owner=self.request.user)
        LedgerMember.objects.create(ledger=ledger, user=self.request.user, role=MemberRole.OWNER, joined_at=timezone.now())


class LedgerDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = LedgerSerializer

    def get_queryset(self):
        return Ledger.objects.filter(members__user=self.request.user)

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [IsOwnerOrEditor()]
        return [IsMember()]


class InviteCreateView(APIView):
    def post(self, request, ledger_pk):
        ledger = generics.get_object_or_404(Ledger, pk=ledger_pk)
        membership = ledger.membership_for(request.user)
        if membership is None or membership.role not in (MemberRole.OWNER, MemberRole.EDITOR):
            raise PermissionDenied
        serializer = InviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite = InviteToken.objects.create(
            ledger=ledger,
            created_by=request.user,
            role=serializer.validated_data["role"],
        )
        return Response(InviteTokenSerializer(invite).data, status=status.HTTP_201_CREATED)


class InviteAcceptView(APIView):
    def post(self, request, token):
        invite = InviteToken.objects.filter(token=token, accepted_at__isnull=True).first()
        if invite is None:
            raise NotFound("Invalid or already used invite token.")
        if invite.ledger.membership_for(request.user) is not None:
            return Response({"detail": "Already a member."}, status=status.HTTP_200_OK)
        LedgerMember.objects.create(
            ledger=invite.ledger,
            user=request.user,
            role=invite.role,
            joined_at=timezone.now(),
        )
        invite.accepted_by = request.user
        invite.accepted_at = timezone.now()
        invite.save(update_fields=["accepted_by", "accepted_at"])
        return Response({"detail": "Joined ledger."}, status=status.HTTP_200_OK)
