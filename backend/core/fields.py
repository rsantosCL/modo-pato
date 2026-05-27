import calendar

from django.db.models import JSONField


class MonthListField(JSONField):
    """JSONField that stores a list of month numbers (1–12) and returns calendar.Month instances."""

    def from_db_value(self, value, expression, connection):
        value = super().from_db_value(value, expression, connection)
        if value is None:
            return None
        return [calendar.Month(m) for m in value]

    def to_python(self, value):
        value = super().to_python(value)
        if value is None:
            return None
        if isinstance(value, list):
            return [calendar.Month(m) if isinstance(m, int) else m for m in value]
        return value

    def get_prep_value(self, value):
        if value is not None:
            value = [int(m) for m in value]
        return super().get_prep_value(value)
