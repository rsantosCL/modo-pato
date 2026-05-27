import calendar

from django.db.models import JSONField


class _MonthListDescriptor:
    """Intercepts assignment to normalize values to calendar.Month instances."""

    def __init__(self, name):
        self.name = name

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return obj.__dict__.get(self.name)

    def __set__(self, obj, value):
        if value is not None:
            value = [
                m if isinstance(m, calendar.Month) else calendar.Month(int(m))
                for m in value
            ]
        obj.__dict__[self.name] = value


class MonthListField(JSONField):
    """JSONField that stores month numbers as JSON integers and always exposes calendar.Month instances.

    Normalization happens on every assignment (including objects.create() and direct attribute set),
    not just on DB reads.
    """

    def contribute_to_class(self, cls, name, private_only=False):
        super().contribute_to_class(cls, name, private_only=private_only)
        setattr(cls, name, _MonthListDescriptor(name))

    def from_db_value(self, value, expression, connection):
        value = super().from_db_value(value, expression, connection)
        if value is None:
            return None
        return [calendar.Month(m) for m in value]

    def get_prep_value(self, value):
        if value is not None:
            value = [int(m) for m in value]
        return super().get_prep_value(value)
