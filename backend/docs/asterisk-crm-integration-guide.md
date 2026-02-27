# Asterisk + CRM Integration Guide

Эта инструкция включает:
- click-to-call из CRM (`POST /api/crm/calls/dial`),
- прием завершенных звонков из Asterisk (`POST /api/crm/intake/calls`),
- запись разговора -> расшифровка -> AI-оценка -> начисление баллов.

## 1) Что уже реализовано в backend

- Click-to-call через Asterisk AMI:
  - endpoint: `POST /api/crm/calls/dial`
  - backend файл: `backend/src/server.ts`
- Intake webhook для CDR/записей:
  - endpoint: `POST /api/crm/intake/calls`
- Автоанализ звонков и сохранение в:
  - `portalmkk_crm_calls`
  - `portalmkk_crm_call_evaluations`
  - `portalmkk_crm_call_tasks` (опционально)
- Начисление баллов за качество звонка:
  - action key по умолчанию: `manual_bonus`

## 2) Переменные окружения backend

Добавьте в `backend/.env` (или в Coolify):

```env
# CRM intake
CRM_INTAKE_ENABLED=true
CRM_INTAKE_SHARED_SECRET=replace_with_long_secret
CRM_INTAKE_AUTO_ANALYZE_DEFAULT=true

# Asterisk AMI (click-to-call)
ASTERISK_AMI_ENABLED=true
ASTERISK_AMI_HOST=127.0.0.1
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USERNAME=crm_ami_user
ASTERISK_AMI_SECRET=strong_ami_secret
ASTERISK_AMI_TIMEOUT_MS=15000
ASTERISK_ORIGINATE_CONTEXT=from-internal
ASTERISK_ORIGINATE_PRIORITY=1
ASTERISK_ORIGINATE_CHANNEL_TEMPLATE=PJSIP/{agent}
ASTERISK_OUTBOUND_PREFIX=

# Опционально: внешний сервис расшифровки записи
CRM_TRANSCRIBE_WEBHOOK_URL=https://stt.example.com/transcribe
CRM_TRANSCRIBE_WEBHOOK_SECRET=replace_with_long_secret

# Баллы за качество звонка
CRM_CALL_POINTS_ENABLED=true
CRM_CALL_POINTS_ACTION_KEY=manual_bonus
CRM_CALL_POINTS_MIN_SCORE=60
CRM_CALL_POINTS_MAX_PER_CALL=25
```

Важно:
- `ASTERISK_ORIGINATE_CHANNEL_TEMPLATE` должен соответствовать вашей телефонии (`PJSIP/{agent}` или `SIP/{agent}`).
- `ASTERISK_ORIGINATE_CONTEXT` должен существовать в dialplan Asterisk.

## 3) Настройка Asterisk AMI

Файл: `manager.conf`

Пример:

```ini
[crm_ami_user]
secret = strong_ami_secret
read = system,call,log,verbose,command,agent,user
write = system,call,log,verbose,command,agent,user,originate
permit = 127.0.0.1/255.255.255.255
deny = 0.0.0.0/0.0.0.0
```

Если backend не на том же хосте:
- разрешите IP backend в `permit`,
- ограничьте доступ firewall-ом к порту `5038`.

Проверка AMI:

```bash
telnet <ASTERISK_HOST> 5038
```

Должно прийти приветствие AMI.

## 4) Click-to-call поток

CRM отправляет:

```json
{
  "clientId": 123,
  "provider": "asterisk",
  "employeeExtension": "201"
}
```

Endpoint:
- `POST /api/crm/calls/dial`

Поведение:
1. Backend валидирует доступ к клиенту.
2. Формирует AMI `Originate`.
3. Звонит на `Channel` сотрудника (`PJSIP/201`), затем набирает номер клиента.
4. Возвращает `actionId`.

## 5) Отправка завершенных звонков из Asterisk в CRM

Нужно настроить webhook вызов после завершения звонка.

Пример в `extensions.conf`:

```asterisk
[crm-intake-hook]
exten => s,1,NoOp(CRM intake webhook)
 same => n,Set(CRM_URL=https://api.example.com/api/crm/intake/calls)
 same => n,Set(CRM_SECRET=replace_with_long_secret)
 same => n,Set(JSON={"provider":"asterisk","externalCallId":"${UNIQUEID}","eventType":"call_finished","clientPhone":"${CALLERID(num)}","employeePhone":"${CONNECTEDLINE(num)}","startedAt":"${STRFTIME(${CDR(start)},,%Y-%m-%dT%H:%M:%S.000Z)}","endedAt":"${STRFTIME(${EPOCH},,%Y-%m-%dT%H:%M:%S.000Z)}","durationSec":${CDR(billsec)},"recordingUrl":"${MIXMONITOR_FILENAME}","source":"asterisk-main","autoAnalyze":true,"createTasks":true})
 same => n,System(curl -sS -X POST "${CRM_URL}" -H "Content-Type: application/json" -H "x-crm-intake-secret: ${CRM_SECRET}" -d '${JSON}')
 same => n,Return()
```

Минимальные поля webhook:
- `provider`
- `externalCallId`
- `clientPhone`

Рекомендуемые:
- `employeePhone`
- `startedAt`, `endedAt`, `durationSec`
- `recordingUrl`
- `transcriptRaw` (если есть готовая расшифровка)

## 6) Запись и расшифровка

Варианты:
1. Asterisk/интеграция сразу передает `transcriptRaw` в intake webhook.
2. Передаете только `recordingUrl`, а backend запрашивает расшифровку через `CRM_TRANSCRIBE_WEBHOOK_URL`.

Ожидаемый ответ STT webhook:

```json
{
  "transcriptRaw": "полный текст разговора"
}
```

## 7) Начисление баллов

После AI-оценки backend считает баллы по `overallScore`:
- ниже `CRM_CALL_POINTS_MIN_SCORE` -> 0,
- иначе до `CRM_CALL_POINTS_MAX_PER_CALL`.

Событие пишется в `portalmkk_points_events` с `dedupe_key = crm_call_qa:{callId}`.

## 8) Проверка после запуска

1. Нажмите в CRM: `Позвонить через Asterisk`.
2. Проверьте, что менеджеру пришел вызов на его внутренний номер.
3. Завершите звонок, убедитесь, что webhook ушел в `/api/crm/intake/calls`.
4. Проверьте в БД:
   - появилась запись в `portalmkk_crm_calls`,
   - статус анализа `ready` (если есть transcript/STT),
   - появилась оценка в `portalmkk_crm_call_evaluations`,
   - появились баллы в `portalmkk_points_events` (если включено).

## 9) Частые проблемы

- `Asterisk integration is disabled`
  - проверьте `ASTERISK_AMI_ENABLED=true`.
- `Asterisk AMI credentials are missing`
  - задайте `ASTERISK_AMI_USERNAME/ASTERISK_AMI_SECRET`.
- `Asterisk AMI login failed`
  - ошибка в `manager.conf` или IP не разрешен.
- `Invalid CRM intake secret`
  - не совпадает `x-crm-intake-secret`.
- `Transcription webhook failed`
  - недоступен `CRM_TRANSCRIBE_WEBHOOK_URL` или неверный secret.

## 10) Рекомендации по продакшену

- Ограничьте AMI по IP + firewall.
- Используйте длинные секреты для intake/STT.
- Если возможно, проксируйте webhook через HTTPS.
- Логируйте `ActionID` и `externalCallId` для быстрой трассировки.
