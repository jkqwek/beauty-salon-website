import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """ClientNote -> ClientProfile: добавился телефон, комментарии сохраняются."""

    dependencies = [
        ('accounts', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RenameModel('ClientNote', 'ClientProfile'),
        migrations.RenameField('clientprofile', 'text', 'note'),
        migrations.AlterField(
            model_name='clientprofile',
            name='note',
            field=models.TextField(blank=True, verbose_name='Внутренний комментарий'),
        ),
        migrations.AlterField(
            model_name='clientprofile',
            name='client',
            field=models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='clientprofile',
            name='phone',
            field=models.CharField(blank=True, max_length=20, verbose_name='Телефон'),
        ),
        migrations.AlterModelOptions(
            name='clientprofile',
            options={'verbose_name': 'Профиль клиента', 'verbose_name_plural': 'Профили клиентов'},
        ),
    ]
