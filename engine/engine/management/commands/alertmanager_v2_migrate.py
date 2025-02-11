from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.alerts.models import AlertReceiveChannel

ALERTMANAGER = "alertmanager"
LEGACY_ALERTMANAGER = "legacy_alertmanager"
GRAFANA_ALERTING = "grafana_alerting"
LEGACY_GRAFANA_ALERTING = "legacy_grafana_alerting"
TEMPLATE_FIELDS = [
    "web_title_template",
    "web_message_template",
    "web_image_url_template",
    "sms_title_template",
    "phone_call_title_template",
    "source_link_template",
    "grouping_id_template",
    "resolve_condition_template",
    "acknowledge_condition_template",
    "slack_title_template",
    "slack_message_template",
    "slack_image_url_template",
    "telegram_title_template",
    "telegram_message_template",
    "telegram_image_url_template",
    "messaging_backends_templates",
]


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument("--backward", action="store_true", help="Run the migration backward.")

    def handle(self, *args, **options):
        if options["backward"]:
            self.migrate_backward()
        else:
            self.migrate_forward()

    @transaction.atomic
    def migrate_forward(self):
        now = timezone.now()
        self.stdout.write(f"Forward migration started at {now}.")

        self.stdout.write(
            "Migrating legacy Alertmanager integrations "
            "(updating fields 'integration' and 'alertmanager_v2_migrated_at')."
        )
        num_updated = AlertReceiveChannel.objects.filter(integration=LEGACY_ALERTMANAGER).update(
            integration=ALERTMANAGER, alertmanager_v2_migrated_at=now
        )
        self.stdout.write(f"Migrated {num_updated} legacy Alertmanager integrations.")

        self.stdout.write(
            "Migrating legacy Grafana Alerting integrations "
            "(updating fields 'integration' and 'alertmanager_v2_migrated_at')."
        )
        num_updated = AlertReceiveChannel.objects.filter(integration=LEGACY_GRAFANA_ALERTING).update(
            integration=GRAFANA_ALERTING, alertmanager_v2_migrated_at=now
        )
        self.stdout.write(f"Migrated {num_updated} legacy Grafana Alerting integrations.")

        self.stdout.write("Fetching integrations to back up & reset templates.")
        alert_receive_channels = AlertReceiveChannel.objects.filter(
            Q(
                **{f"{field}__isnull": False for field in TEMPLATE_FIELDS},
                _connector=Q.OR,
            ),
            integration__in=[ALERTMANAGER, GRAFANA_ALERTING],
            alertmanager_v2_migrated_at__isnull=False,
        )
        self.stdout.write(f"Backing up & resetting templates for {len(alert_receive_channels)} integrations.")

        for alert_receive_channel in alert_receive_channels:
            self.stdout.write(
                f"Backing up & resetting templates for integration {alert_receive_channel.public_primary_key}."
            )
            alert_receive_channel.alertmanager_v2_backup_templates = {
                field: getattr(alert_receive_channel, field) for field in TEMPLATE_FIELDS
            }
            for field in TEMPLATE_FIELDS:
                setattr(alert_receive_channel, field, None)

        self.stdout.write(f"Bulk updating templates for {len(alert_receive_channels)} integrations.")
        num_updated = AlertReceiveChannel.objects.bulk_update(
            alert_receive_channels,
            fields=[
                *TEMPLATE_FIELDS,
                "alertmanager_v2_backup_templates",
            ],
            batch_size=1000,
        )
        self.stdout.write(f"Bulk updated templates for {num_updated} integrations.")

        self.stdout.write("Forward migration finished.")

    @transaction.atomic
    def migrate_backward(self):
        now = timezone.now()
        self.stdout.write(f"Backward migration started at {now}.")

        self.stdout.write(
            "Backward migrating Alertmanager integrations "
            "(updating fields 'integration' and 'alertmanager_v2_migrated_at')."
        )
        num_updated = AlertReceiveChannel.objects.filter(
            integration=ALERTMANAGER, alertmanager_v2_migrated_at__isnull=False
        ).update(integration=LEGACY_ALERTMANAGER, alertmanager_v2_migrated_at=None)
        self.stdout.write(f"Backward migrated {num_updated} Alertmanager integrations.")

        self.stdout.write(
            "Backward migrating Grafana Alerting integrations "
            "(updating fields 'integration' and 'alertmanager_v2_migrated_at')."
        )
        num_updated = AlertReceiveChannel.objects.filter(
            integration=GRAFANA_ALERTING, alertmanager_v2_migrated_at__isnull=False
        ).update(integration=LEGACY_GRAFANA_ALERTING, alertmanager_v2_migrated_at=None)
        self.stdout.write(f"Backward migrated {num_updated} Grafana Alerting integrations.")

        self.stdout.write("Fetching integrations to restore templates from backup.")
        alert_receive_channels = AlertReceiveChannel.objects.filter(
            integration__in=[LEGACY_ALERTMANAGER, LEGACY_GRAFANA_ALERTING],
            alertmanager_v2_backup_templates__isnull=False,
        )
        self.stdout.write(f"Restoring templates for {len(alert_receive_channels)} integrations.")

        for alert_receive_channel in alert_receive_channels:
            self.stdout.write(f"Restoring templates for integration {alert_receive_channel.public_primary_key}.")
            if alert_receive_channel.alertmanager_v2_backup_templates is None:
                continue
            for field in TEMPLATE_FIELDS:
                setattr(alert_receive_channel, field, alert_receive_channel.alertmanager_v2_backup_templates.get(field))
            alert_receive_channel.alertmanager_v2_backup_templates = None

        self.stdout.write(f"Bulk updating templates for {len(alert_receive_channels)} integrations.")
        num_updated = AlertReceiveChannel.objects.bulk_update(
            alert_receive_channels,
            fields=[
                *TEMPLATE_FIELDS,
                "alertmanager_v2_backup_templates",
            ],
            batch_size=1000,
        )
        self.stdout.write(f"Bulk updated templates for {num_updated} integrations.")

        self.stdout.write("Backward migration finished.")
