from django.db import models


class ItemCategory(models.TextChoices):
    INCOME = "income", "Income"
    ESSENTIAL = "essential", "Essential"
    VARIABLE = "variable", "Variable"
    PROVISION = "provision", "Provision"


class ItemFrequency(models.TextChoices):
    MONTHLY = "M", "Monthly"
    QUARTERLY = "Q", "Quarterly"
    HALF_YEARLY = "H", "Half-yearly"
    YEARLY = "Y", "Yearly"
    CUSTOM = "CUSTOM", "Custom"


class PaymentSource(models.TextChoices):
    CASH = "CASH", "Cash"
    CREDIT_CARD = "CREDIT_CARD", "Credit Card"


class CurrencyType(models.TextChoices):
    CLP = "CLP", "CLP"
    CLF = "CLF", "CLF"
    USD = "USD", "USD"
